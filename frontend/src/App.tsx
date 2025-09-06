import React, { useState } from 'react';
import './App.css';

function App() {
  const [sceneDescription, setSceneDescription] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/generate-storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scene_description: sceneDescription }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate storyboard');
      }
      const data = await response.json();
      setText(data.text);
      setImage(data.image);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Storyboard Generator</h1>
        <textarea
          value={sceneDescription}
          onChange={(e) => setSceneDescription(e.target.value)}
          placeholder="Enter scene description..."
          rows={4}
          cols={50}
        />
        <br />
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Storyboard'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {text && (
          <div>
            <h2>Screenplay:</h2>
            <p>{text}</p>
          </div>
        )}
        {image && (
          <div>
            <h2>Storyboard:</h2>
            <img src={`http://localhost:5000/${image}`} alt="Storyboard" />
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
