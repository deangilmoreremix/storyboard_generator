# Storyboard Generator

**Author** - Rasswanth S  
**Email** - rasswanth@lyzr.ai

A storyboard generator and screenplay writer. Using a small description of a scene, the app writes a screenplay and generates a storyboard for it using GPT-4o.

## Architecture
- Flask backend API for storyboard generation
- React frontend for user interface
- OpenAI GPT-4o integration for content creation

## Setup
1. OpenAI API key is already configured in .env file ✅
2. Install Python dependencies: pip install -r requirements.txt
3. Install frontend dependencies: cd frontend && npm install
4. Run the Flask API: python app.py
5. Run the frontend: cd frontend && npm run dev
6. The API uses GPT-4o for screenplay generation and DALL-E 3 for storyboard image

## Links

**Medium** - https://medium.com/@rasswanthshankar/boost-your-filmmaking-workflow-create-storyboards-and-write-scenes-using-lyzr-automata-aa9c18394b4c

**Video Walkthrough** - https://tella.video/storyboard-generator-8fpi