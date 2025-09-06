from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
from dotenv import load_dotenv
import requests
from io import BytesIO
from PIL import Image

load_dotenv()

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes

openai.api_key = os.getenv("OPENAI_API_KEY")

@app.route('/generate-storyboard', methods=['POST'])
def generate_storyboard():
    data = request.get_json()
    scene_description = data.get('scene_description', '')

    if not scene_description:
        return jsonify({'error': 'Scene description is required'}), 400

    # Generate screenplay text using GPT-5
    text_prompt = f"Use the scene description provided and write 4 shots for a movie in 200 words. Use your creativity. [IMPORTANT!] Setup the location and characters in a detailed manner. Scene description: {scene_description}"
    text_response = openai.chat.completions.create(
        model="gpt-5",
        messages=[{"role": "user", "content": text_prompt}],
        max_tokens=1500,
        temperature=0.5
    )
    text = text_response.choices[0].message.content.strip()

    # Generate storyboard image using DALL-E 3
    image_prompt = f"Generate a set of 4 storyboard drawings for the given scene description. Capture every detail. Minimalistic style. [IMPORTANT!] Avoid any text or numbers in the image. Scene description: {scene_description}"
    image_response = openai.images.generate(
        model="dall-e-3",
        prompt=image_prompt,
        n=1,
        size="1024x1024"
    )
    image_url = image_response.data[0].url

    # Download and save the image
    response = requests.get(image_url)
    image = Image.open(BytesIO(response.content))
    image_path = "generated_storyboard.png"
    image.save(image_path)

    return jsonify({
        'text': text,
        'image': image_path
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)