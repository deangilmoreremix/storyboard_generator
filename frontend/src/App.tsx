import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ReasoningEffort, Storyboard, ImageStep, MultiStepImageResult } from '../lib/types';
import './App.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Tab = 'storyboard' | 'websearch' | 'image' | 'edit' | 'variation' | 'multistep' | 'video' | 'stream';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Auth forms
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  
  // Storyboard form
  const [sceneDescription, setSceneDescription] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('medium');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [enableImageGeneration, setEnableImageGeneration] = useState(false);
  const [storyboardResult, setStoryboardResult] = useState<Storyboard | null>(null);
  
  // Web search form
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [webSearchResult, setWebSearchResult] = useState('');
  
  // Image generation form
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState<string>('auto');
  const [imageQuality, setImageQuality] = useState<string>('auto');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  
  // Image editing form
  const [editImage, setEditImage] = useState<string>('');
  const [editMask, setEditMask] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editedImages, setEditedImages] = useState<string[]>([]);
  
  // Image variation form
  const [variationImage, setVariationImage] = useState<string>('');
  const [variationCount, setVariationCount] = useState(2);
  const [variationImages, setVariationImages] = useState<string[]>([]);
  
  // Multi-step image form
  const [multistepPrompt, setMultistepPrompt] = useState('');
  const [multistepSteps, setMultistepSteps] = useState<ImageStep[]>([
    { step: 'generate', prompt: '' },
    { step: 'refine', prompt: '' },
    { step: 'finalize', prompt: '' },
  ]);
  const [multistepResults, setMultistepResults] = useState<MultiStepImageResult[]>([]);
  
  // Video generation form
  const [videoStoryboardId, setVideoStoryboardId] = useState('');
  const [videoSceneDescription, setVideoSceneDescription] = useState('');
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoResolution, setVideoResolution] = useState('720p');
  const [videoUrl, setVideoUrl] = useState('');
  
  // Streaming response
  const [streamQuery, setStreamQuery] = useState('');
  const [streamResult, setStreamResult] = useState('');
  
  const [activeTab, setActiveTab] = useState<Tab>('storyboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });
      if (error) throw error;
      setSession(data.session);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
      });
      if (error) throw error;
      setSession(data.session);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleGenerateStoryboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-storyboard', {
        body: {
          scene_description: sceneDescription,
          reasoning_effort: reasoningEffort,
          enable_web_search: enableWebSearch,
          enable_image_generation: enableImageGeneration,
        },
      });
      
      if (error) throw error;
      // Extract output_text from response
      const content = data.output_text || data.text || '';
      const storyboard: Storyboard = {
        id: '',
        user_id: session?.user?.id || '',
        title: sceneDescription.substring(0, 100),
        description: sceneDescription,
        content: { scenes: [] },
      };
      
      // Check if image was generated
      if (data.output) {
        for (const item of data.output) {
          if (item.type === 'image_generation_call' && item.result) {
            storyboard.image_url = item.result;
            break;
          }
        }
      }
      
      setStoryboardResult(storyboard);
    } catch (err: any) {
      setError(err.message || 'Failed to generate storyboard');
    } finally {
      setLoading(false);
    }
  };

  const handleWebSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('web-search', {
        body: {
          query: webSearchQuery,
          reasoning_effort: reasoningEffort,
        },
      });
      
      if (error) throw error;
      setWebSearchResult(data.output_text || '');
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: imagePrompt,
          size: imageSize,
          quality: imageQuality,
        },
      });
      
      if (error) throw error;
      setGeneratedImages([data.imageUrl || data.image_url || '']);
    } catch (err: any) {
      setError(err.message || 'Image generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEditImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', editImage);
      if (editMask) formData.append('mask', editMask);
      formData.append('prompt', editPrompt);
      formData.append('size', imageSize);
      formData.append('quality', imageQuality);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/edit-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });
      
      if (!response.ok) throw new Error('Edit failed');
      const data = await response.json();
      setEditedImages(data.imageUrls || []);
    } catch (err: any) {
      setError(err.message || 'Image edit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', variationImage);
      formData.append('n', Math.min(variationCount, 4).toString());
      formData.append('size', imageSize);
      formData.append('quality', imageQuality);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/create-variation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });
      
      if (!response.ok) throw new Error('Variation failed');
      const data = await response.json();
      setVariationImages(data.imageUrls || []);
    } catch (err: any) {
      setError(err.message || 'Image variation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMultiStepImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const validSteps = multistepSteps.filter(s => s.prompt.trim());
      
      const { data, error } = await supabase.functions.invoke('multi-step-image', {
        body: {
          steps: validSteps.length > 0 ? validSteps : [{ step: 'generate', prompt: multistepPrompt }],
        },
      });
      
      if (error) throw error;
      setMultistepResults(data.results || []);
    } catch (err: any) {
      setError(err.message || 'Multi-step generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const webhookUrl = `${supabaseUrl}/functions/v1/video-webhook`;
      
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          storyboardId: videoStoryboardId,
          sceneDescription: videoSceneDescription,
          duration: videoDuration,
          resolution: videoResolution,
          webhookUrl,
        },
      });
      
      if (error) throw error;
      
      if (data?.status === 'pending') {
        setError('Video generation in progress. Will update when complete.');
      } else {
        setVideoUrl(data?.videoUrl || data?.video_url || '');
      }
    } catch (err: any) {
      setError(err.message || 'Video generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStreamResult('');
    try {
      const { data, error } = await supabase.functions.invoke('stream-response', {
        body: {
          prompt: streamQuery,
          reasoning_effort: reasoningEffort,
        },
      });

      if (error) throw error;
      setStreamResult(data.output_text || '');
    } catch (err: any) {
      setError(err.message || 'Streaming failed');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Storyboard Generator</h1>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
            <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
              <h2>Sign In</h2>
              <form onSubmit={handleSignIn}>
                <input
                  type="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="Email"
                  required
                  style={{ marginBottom: '0.5rem', width: '100%' }}
                />
                <br />
                <input
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="Password"
                  required
                  style={{ marginBottom: '0.5rem', width: '100%' }}
                />
                <br />
                <button type="submit" disabled={loading}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            </div>
            
            <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
              <h2>Sign Up</h2>
              <form onSubmit={handleSignUp}>
                <input
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="Email"
                  required
                  style={{ marginBottom: '0.5rem', width: '100%' }}
                />
                <br />
                <input
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Password"
                  required
                  style={{ marginBottom: '0.5rem', width: '100%' }}
                />
                <br />
                <button type="submit" disabled={loading}>
                  {loading ? 'Signing Up...' : 'Sign Up'}
                </button>
              </form>
            </div>
          </div>
          {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px' }}>
          <h1>Storyboard Generator</h1>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
        
        <nav style={{ margin: '1rem 0' }}>
          <button onClick={() => setActiveTab('storyboard')} disabled={activeTab === 'storyboard'}>Storyboard</button>
          <button onClick={() => setActiveTab('websearch')} disabled={activeTab === 'websearch'}>Web Search</button>
          <button onClick={() => setActiveTab('image')} disabled={activeTab === 'image'}>Image Gen</button>
          <button onClick={() => setActiveTab('edit')} disabled={activeTab === 'edit'}>Image Edit</button>
          <button onClick={() => setActiveTab('variation')} disabled={activeTab === 'variation'}>Variation</button>
          <button onClick={() => setActiveTab('multistep')} disabled={activeTab === 'multistep'}>Multi-Step</button>
          <button onClick={() => setActiveTab('video')} disabled={activeTab === 'video'}>Video Gen</button>
          <button onClick={() => setActiveTab('stream')} disabled={activeTab === 'stream'}>Streaming</button>
        </nav>

        {activeTab === 'storyboard' && (
          <form onSubmit={handleGenerateStoryboard} style={{ width: '100%', maxWidth: '600px' }}>
            <textarea
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              placeholder="Enter scene description..."
              rows={4}
              cols={50}
              required
            />
            <br />
            <label>
              Reasoning Effort:
              <select value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <br />
            <label>
              <input
                type="checkbox"
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
              />
              Enable Web Search
            </label>
            <br />
            <label>
              <input
                type="checkbox"
                checked={enableImageGeneration}
                onChange={(e) => setEnableImageGeneration(e.target.checked)}
              />
              Enable Image Generation
            </label>
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Storyboard'}
            </button>
            
            {storyboardResult && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Result:</h2>
                {storyboardResult.image_url && (
                  <img src={storyboardResult.image_url} alt="Generated" style={{ maxWidth: '100%' }} />
                )}
                {storyboardResult.video_url && (
                  <video src={storyboardResult.video_url} controls style={{ maxWidth: '100%' }} />
                )}
              </div>
            )}
          </form>
        )}

        {activeTab === 'websearch' && (
          <form onSubmit={handleWebSearch} style={{ width: '100%', maxWidth: '600px' }}>
            <input
              type="text"
              value={webSearchQuery}
              onChange={(e) => setWebSearchQuery(e.target.value)}
              placeholder="Enter search query..."
              required
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
            
            {webSearchResult && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Search Result:</h2>
                <p>{webSearchResult}</p>
              </div>
            )}
          </form>
        )}

        {activeTab === 'image' && (
          <form onSubmit={handleGenerateImage} style={{ width: '100%', maxWidth: '600px' }}>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Enter image prompt..."
              rows={4}
              cols={50}
              required
            />
            <br />
            <label>
              Size:
              <select value={imageSize} onChange={(e) => setImageSize(e.target.value)}>
                <option value="auto">Auto</option>
                <option value="1024x1024">1024x1024</option>
                <option value="1536x1024">1536x1024</option>
                <option value="1024x1536">1024x1536</option>
                <option value="1536x1536">1536x1536</option>
              </select>
            </label>
            <br />
            <label>
              Quality:
              <select value={imageQuality} onChange={(e) => setImageQuality(e.target.value)}>
                <option value="auto">Auto</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Image'}
            </button>

            {generatedImages.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Generated Images:</h2>
                {generatedImages.map((url, idx) => (
                  <img key={idx} src={url} alt={`Generated ${idx}`} style={{ maxWidth: '100%', marginBottom: '0.5rem' }} />
                ))}
              </div>
            )}
          </form>
        )}

        {activeTab === 'edit' && (
          <form onSubmit={handleEditImage} style={{ width: '100%', maxWidth: '600px' }}>
            <textarea
              value={editImage}
              onChange={(e) => setEditImage(e.target.value)}
              placeholder="Enter base64 image data or URL..."
              rows={3}
              cols={50}
              required
            />
            <br />
            <textarea
              value={editMask}
              onChange={(e) => setEditMask(e.target.value)}
              placeholder="Enter mask (optional)..."
              rows={2}
              cols={50}
            />
            <br />
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="Enter edit prompt..."
              rows={3}
              cols={50}
              required
            />
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Editing...' : 'Edit Image'}
            </button>

            {editedImages.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Edited Images:</h2>
                {editedImages.map((url, idx) => (
                  <img key={idx} src={url} alt={`Edited ${idx}`} style={{ maxWidth: '100%', marginBottom: '0.5rem' }} />
                ))}
              </div>
            )}
          </form>
        )}

        {activeTab === 'variation' && (
          <form onSubmit={handleCreateVariation} style={{ width: '100%', maxWidth: '600px' }}>
            <textarea
              value={variationImage}
              onChange={(e) => setVariationImage(e.target.value)}
              placeholder="Enter base64 image data or URL..."
              rows={3}
              cols={50}
              required
            />
            <br />
            <label>
              Number of Variations (1-4):
              <input
                type="number"
                value={variationCount}
                onChange={(e) => setVariationCount(Math.min(4, Math.max(1, Number(e.target.value))))}
                min={1}
                max={4}
              />
            </label>
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Variations'}
            </button>

            {variationImages.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Image Variations:</h2>
                {variationImages.map((url, idx) => (
                  <img key={idx} src={url} alt={`Variation ${idx}`} style={{ maxWidth: '100%', marginBottom: '0.5rem' }} />
                ))}
              </div>
            )}
          </form>
        )}

        {activeTab === 'multistep' && (
          <form onSubmit={handleMultiStepImage} style={{ width: '100%', maxWidth: '600px' }}>
            <textarea
              value={multistepPrompt}
              onChange={(e) => setMultistepPrompt(e.target.value)}
              placeholder="Enter main prompt (or use steps below)..."
              rows={3}
              cols={50}
            />
            <h3 style={{ marginTop: '1rem' }}>Or configure multi-step workflow:</h3>
            {multistepSteps.map((step, idx) => (
              <div key={idx} style={{ marginBottom: '0.5rem' }}>
                <label>
                  Step {idx + 1} - {step.step}:
                  <select
                    value={step.step}
                    onChange={(e) => setMultistepSteps([...multistepSteps.slice(0, idx), { ...step, step: e.target.value as any }, ...multistepSteps.slice(idx + 1)])}
                  >
                    <option value="generate">Generate</option>
                    <option value="refine">Refine</option>
                    <option value="finalize">Finalize</option>
                  </select>
                </label>
                <textarea
                  value={step.prompt}
                  onChange={(e) => setMultistepSteps([...multistepSteps.slice(0, idx), { ...step, prompt: e.target.value }, ...multistepSteps.slice(idx + 1)])}
                  placeholder={`Prompt for ${step.step}...`}
                  rows={2}
                  cols={50}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Run Multi-Step'}
            </button>

            {multistepResults.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Multi-Step Results:</h2>
                {multistepResults.map((result, idx) => (
                  <div key={idx} style={{ marginBottom: '1rem' }}>
                    <h4>{result.step}</h4>
                    <img src={result.imageUrl} alt={result.step} style={{ maxWidth: '100%' }} />
                  </div>
                ))}
              </div>
            )}
          </form>
        )}

        {activeTab === 'video' && (
          <form onSubmit={handleGenerateVideo} style={{ width: '100%', maxWidth: '600px' }}>
            <input
              type="text"
              value={videoStoryboardId}
              onChange={(e) => setVideoStoryboardId(e.target.value)}
              placeholder="Storyboard ID"
              required
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <br />
            <textarea
              value={videoSceneDescription}
              onChange={(e) => setVideoSceneDescription(e.target.value)}
              placeholder="Scene description..."
              rows={3}
              cols={50}
              required
            />
            <br />
            <label>
              Duration:
              <input
                type="number"
                value={videoDuration}
                onChange={(e) => setVideoDuration(Number(e.target.value))}
                min={1}
                max={30}
              />
            </label>
            <br />
            <label>
              Resolution:
              <select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value)}>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K</option>
              </select>
            </label>
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Video'}
            </button>
            
            {videoUrl && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Generated Video:</h2>
                <video src={videoUrl} controls style={{ maxWidth: '100%' }} />
              </div>
            )}
          </form>
        )}

        {activeTab === 'stream' && (
          <form onSubmit={handleStream} style={{ width: '100%', maxWidth: '600px' }}>
            <textarea
              value={streamQuery}
              onChange={(e) => setStreamQuery(e.target.value)}
              placeholder="Enter stream query..."
              rows={4}
              cols={50}
              required
            />
            <br />
            <label>
              Reasoning Effort:
              <select value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <br />
            <button type="submit" disabled={loading}>
              {loading ? 'Streaming...' : 'Stream Response'}
            </button>
            
            {streamResult && (
              <div style={{ marginTop: '1rem' }}>
                <h2>Stream Result:</h2>
                <p>{streamResult}</p>
              </div>
            )}
          </form>
        )}

        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      </header>
    </div>
  );
}

export default App;