import { useState } from 'react';
import './TaskPanel.css';

function TaskPanel({ tasks, onRefresh }) {
  const [expandedTask, setExpandedTask] = useState(null);

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  const toggleTask = async (index) => {
    try {
      await fetch('http://localhost:5000/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
      });
      onRefresh();
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const clearTasks = async () => {
    if (!window.confirm('Clear all tasks?')) return;
    
    try {
      await fetch('http://localhost:5000/tasks/clear', {
        method: 'POST'
      });
      onRefresh();
    } catch (error) {
      console.error('Error clearing tasks:', error);
    }
  };

  return (
    <div className="task-panel">
      <div className="panel-header">
        <h3>📋 Your Tasks</h3>
        {totalCount > 0 && (
          <span className="task-count">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="empty-state">
          <p>No tasks yet</p>
          <span>Start planning to see tasks here</span>
        </div>
      ) : (
        <>
          <div className="task-list">
            {tasks.map((task, index) => (
              <div 
                key={index} 
                className={`task-item ${task.completed ? 'completed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(index)}
                  className="task-checkbox"
                />
                <div className="task-content">
                  <p className="task-text">{task.task}</p>
                  <span className="task-time">
                    {new Date(task.created).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="panel-actions">
            <button onClick={onRefresh} className="action-btn refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 20V14H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
            <button onClick={clearTasks} className="action-btn clear">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Clear All
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default TaskPanel;