import React, { useState, useEffect } from 'react';
import AddContent from './components/AddContent';
import ItemsList from './components/ItemsList';
import QueryInterface from './components/QueryInterface';
import './App.css';

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch items on mount
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items');
      const data = await response.json();
      
      if (data.success) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const handleContentAdded = () => {
    fetchItems();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧠 AI Knowledge Inbox</h1>
        <p>Save notes and URLs, then ask questions using RAG</p>
      </header>

      <div className="app-container">
        <div className="left-panel">
          <AddContent onContentAdded={handleContentAdded} />
          <ItemsList items={items} />
        </div>

        <div className="right-panel">
          <QueryInterface />
        </div>
      </div>
    </div>
  );
}

export default App;
