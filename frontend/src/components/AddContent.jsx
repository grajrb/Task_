import React, { useState } from 'react';
import './AddContent.css';

function AddContent({ onContentAdded }) {
  const [type, setType] = useState('text');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          content: type === 'text' ? content : undefined,
          url: type === 'url' ? url : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus({ type: 'success', message: data.message });
        setContent('');
        setUrl('');
        onContentAdded?.();
      } else {
        setStatus({
          type: 'error',
          message: data.error?.message || 'Failed to ingest content',
        });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: 'Network error: ' + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card add-content">
      <h2>📝 Add Content</h2>

      <div className="type-selector">
        <button
          className={`type-btn ${type === 'text' ? 'active' : ''}`}
          onClick={() => setType('text')}
        >
          Text Note
        </button>
        <button
          className={`type-btn ${type === 'url' ? 'active' : ''}`}
          onClick={() => setType('url')}
        >
          URL
        </button>
      </div>

      <form onSubmit={handleSubmit} className="add-content-form">
        {type === 'text' ? (
          <textarea
            className="textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your note here..."
            required
            disabled={loading}
          />
        ) : (
          <input
            type="url"
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            required
            disabled={loading}
          />
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Processing...' : 'Add Content'}
        </button>
      </form>

      {status && (
        <div className={`status status-${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

export default AddContent;
