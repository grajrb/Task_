import React from 'react';
import './ItemsList.css';

function ItemsList({ items }) {
  return (
    <div className="card items-list">
      <h2>📚 Saved Items ({items.length})</h2>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No items yet. Add some content to get started!</p>
        </div>
      ) : (
        <div className="items-container">
          {items.map((item) => (
            <div key={item.id} className="item">
              <div className="item-header">
                <span className="item-type">
                  {item.type === 'text' ? '📝' : '🔗'}
                </span>
                <span className="item-date">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              {item.metadata?.title && (
                <div className="item-title">{item.metadata.title}</div>
              )}
              
              {item.metadata?.url && (
                <div className="item-url">
                  <a href={item.metadata.url} target="_blank" rel="noopener noreferrer">
                    {item.metadata.url}
                  </a>
                </div>
              )}
              
              <div className="item-preview">{item.preview}</div>
              
              <div className="item-meta">
                {item.metadata?.characterCount && (
                  <span>{item.metadata.characterCount.toLocaleString()} chars</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ItemsList;
