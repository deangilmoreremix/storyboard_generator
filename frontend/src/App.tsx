import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const MAX_CHARS = 2000;

export default function App() {
  const [sceneDescription, setSceneDescription] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('openai_api_key');
    if (!storedApiKey) {
      setShowApiModal(true);
    } else {
      setApiKey(storedApiKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('openai_api_key', apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      setShowApiModal(false);
      setApiKeyInput('');
    }
  };

  const handleClear = useCallback(() => {
    setSceneDescription('');
    setText('');
    setImage('');
    setError('');
  }, []);

  const handleCopyScreenplay = useCallback(() => {
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }, [text]);

  const handleGenerate = useCallback(async () => {
    if (!sceneDescription.trim()) {
      setError('Please enter a scene description.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError('');
    setText('');
    setImage('');

    try {
      const response = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scene_description: sceneDescription, api_key: apiKey }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Failed to generate storyboard';

        if (response.status === 401) {
          errorMessage = 'Invalid API key. Please check your API key.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait a moment.';
        } else if (response.status === 400) {
          errorMessage = errorData.error || 'Invalid request. Please check your input.';
        } else if (response.status >= 500) {
          errorMessage = 'Something went wrong. Please try again.';
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setText(data.text || '');
      setImage(data.image || '');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [sceneDescription, apiKey]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="App">
      {showApiModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Enter Your OpenAI API Key</h2>
            <p>
              Your API key is sent to our backend server which proxies requests to OpenAI.
              It is never stored on our servers beyond the current session.
            </p>
            <input
              type="password"
              className="api-key-input"
              placeholder="sk-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              autoFocus
            />
            <button className="modal-btn" onClick={handleSaveApiKey}>
              Save & Continue
            </button>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="modal-link"
            >
              Get an API key from OpenAI
            </a>
          </div>
        </div>
      )}

      <header className="App-header">
        <h1>Storyboard Generator</h1>
        <p>Transform your scene descriptions into visual storyboards</p>

        <div className="storyboard-form">
          <textarea
            className="scene-input"
            value={sceneDescription}
            onChange={(e) => setSceneDescription(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Enter scene description..."
            rows={6}
            disabled={loading}
          />
          <div className="char-counter">
            {sceneDescription.length} / {MAX_CHARS}
          </div>

          <div className="form-actions">
            <button
              className={`generate-btn${loading ? ' loading' : ''}`}
              onClick={handleGenerate}
              disabled={loading || !sceneDescription.trim()}
            >
              {loading ? '' : 'Generate Storyboard'}
            </button>
            <button
              className="clear-btn"
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}

        {(text || image) && (
          <div className="storyboard-result">
            {text && (
              <div className="storyboard-text">
                <h3>Screenplay</h3>
                <p>{text}</p>
                <button className="copy-btn" onClick={handleCopyScreenplay}>
                  Copy screenplay
                </button>
              </div>
            )}
            {image && (
              <div className="storyboard-image">
                <h3>Storyboard</h3>
                <img
                  className="storyboard-img"
                  src={`/api/serve-image/${image}`}
                  alt="Storyboard"
                />
              </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}
