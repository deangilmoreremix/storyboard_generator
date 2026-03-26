from flask import Flask, request, jsonify, after_request
from flask_cors import CORS
import openai
from openai import AuthenticationError, RateLimitError, BadRequestError
import os
from dotenv import load_dotenv
import requests
from io import BytesIO
from PIL import Image
from werkzeug.utils import secure_filename
import uuid
import time
import logging
import functools
import threading

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.', static_url_path='')

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS(app, resources={r"/*": {"origins": FRONTEND_ORIGIN, "methods": ["GET", "POST"], "allowed_headers": ["Content-Type"], "supports_credentials": True}})

rate_limit_store = {}
rate_limit_lock = threading.Lock()
RATE_LIMIT = 10
RATE_WINDOW = 60

def rate_limit(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() if request.is_json else {}
        api_key = data.get('api_key') or os.getenv("OPENAI_API_KEY")
        
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        
        with rate_limit_lock:
            now = time.time()
            if api_key not in rate_limit_store:
                rate_limit_store[api_key] = []
            
            rate_limit_store[api_key] = [t for t in rate_limit_store[api_key] if now - t < RATE_WINDOW]
            
            if len(rate_limit_store[api_key]) >= RATE_LIMIT:
                logger.warning(f"Rate limit exceeded for API key: {api_key[:8]}...")
                return jsonify({'error': 'Rate limit exceeded. Try again later.'}), 429
            
            rate_limit_store[api_key].append(now)
        
        return func(*args, **kwargs)
    return wrapper

@app.after_request
def security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Cache-Control'] = 'no-store'
    return response

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'}), 200

@app.route('/generate-storyboard', methods=['POST'])
@rate_limit
def generate_storyboard():
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        
        if data is None:
            return jsonify({'error': 'Invalid JSON body'}), 400
        
        api_key = data.get('api_key') or os.getenv("OPENAI_API_KEY")
        
        if not api_key:
            logger.warning(f"Auth failure: No API key provided from {request.remote_addr}")
            return jsonify({'error': 'API key required'}), 401
        
        scene_description = data.get('scene_description', '')
        
        if not scene_description or not scene_description.strip():
            return jsonify({'error': 'Scene description cannot be empty'}), 400
        
        if len(scene_description) > 2000:
            return jsonify({'error': 'Scene description exceeds 2000 character limit'}), 400
        
        logger.info(f"Request: {request.method} {request.path} from {request.remote_addr} - {request.user_agent}")
        
        openai.api_key = api_key
        
        text_prompt = f"Use the scene description provided and write 4 shots for a movie in 200 words. Use your creativity. [IMPORTANT!] Setup the location and characters in a detailed manner. Scene description: {scene_description}"
        text_response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": text_prompt}],
            max_tokens=1500,
            temperature=0.5,
            timeout=60
        )
        text = text_response.choices[0].message.content.strip()
        
        image_prompt = f"Generate a set of 4 storyboard drawings for the given scene description. Capture every detail. Minimalistic style. [IMPORTANT!] Avoid any text or numbers in the image. Scene description: {scene_description}"
        image_response = openai.images.generate(
            model="dall-e-3",
            prompt=image_prompt,
            n=1,
            size="1024x1024",
            timeout=60
        )
        image_url = image_response.data[0].url
        
        response = requests.get(image_url, timeout=60)
        image = Image.open(BytesIO(response.content))
        
        os.makedirs("outputs", exist_ok=True)
        filename = f"{uuid.uuid4()}.png"
        safe_filename = secure_filename(filename)
        image_path = os.path.join("outputs", safe_filename)
        image.save(image_path)
        
        return jsonify({
            'text': text,
            'image': image_path
        })
    
    except AuthenticationError as e:
        logger.warning(f"Auth error from {request.remote_addr}: Invalid API key")
        return jsonify({'error': 'Invalid API key'}), 401
    except RateLimitError as e:
        logger.warning(f"Rate limit error from {request.remote_addr}")
        return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429
    except BadRequestError as e:
        logger.error(f"Bad request error: quota exceeded or invalid request")
        return jsonify({'error': 'Invalid request or quota exceeded'}), 400
    except Exception as e:
        logger.error(f"Internal error occurred")
        return jsonify({'error': 'An internal error occurred'}), 500

@app.route('/serve-image/<filename>', methods=['GET'])
def serve_image(filename):
    logger.info(f"Request: {request.method} {request.path} from {request.remote_addr}")
    
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
    
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif'}
    if not any(filename.lower().endswith(ext) for ext in allowed_extensions):
        return jsonify({'error': 'Invalid filename'}), 400
    
    image_path = os.path.join('outputs', filename)
    
    if not os.path.isfile(image_path):
        return jsonify({'error': 'File not found'}), 404
    
    ext = os.path.splitext(filename)[1].lower()
    content_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif'
    }
    content_type = content_types.get(ext, 'application/octet-stream')
    
    return app.send_static_file(image_path), 200, {'Content-Type': content_type}

if __name__ == '__main__':
    app.run(debug=False, port=5000)
