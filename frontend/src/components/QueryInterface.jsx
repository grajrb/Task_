import React, { useState } from 'react';
import './QueryInterface.css';

function QueryInterface() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          topK: 5,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult(data);
      } else {
        setError(data.error?.message || 'Failed to process query');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card query-interface">
      <h2>💬 Ask a Question</h2>

      <form onSubmit={handleSubmit} className="query-form">
        <textarea
          className="textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your saved content..."
          required
          disabled={loading}
        />

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Thinking...' : 'Ask Question'}
        </button>
      </form>

      {error && (
        <div className="status status-error">
          {error}
        </div>
      )}

      {result && (
        <div className="query-result">
          <div className="answer-section">
            <h3>Answer</h3>
            <div className="answer-content">{result.answer}</div>
            {result.confidence > 0 && (
              <div className="confidence">
                Confidence: {(result.confidence * 100).toFixed(1)}%
              </div>
            )}
          </div>

          {result.sources && result.sources.length > 0 && (
            <div className="sources-section">
              <h3>Sources ({result.sources.length})</h3>
              <div className="sources-list">
                {result.sources.map((source) => (
                  <div key={source.index} className="source">
                    <div className="source-header">
                      <span className="source-number">[{source.index}]</span>
                      <span className="source-type">
                        {source.itemType === 'text' ? '📝' : '🔗'}
                      </span>
                      {source.metadata?.title && (
                        <span className="source-title">{source.metadata.title}</span>
                      )}
                      <span className="source-similarity">
                        {(source.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="source-content">{source.content}</div>
                    {source.metadata?.url && (
                      <div className="source-url">
                        <a href={source.metadata.url} target="_blank" rel="noopener noreferrer">
                          {source.metadata.url}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QueryInterface;
