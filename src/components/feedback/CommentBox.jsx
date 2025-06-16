import React, { useState } from 'react';

const CommentBox = ({ ticketItem, userType }) => {
  // Destructure ticketItem fields
  const { subject, name, comments } = ticketItem;

  // State to manage new comment input
  const [newComment, setNewComment] = useState('');

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      // Add the new comment to the comments array (mocking this for now)
      console.log({
        comment: newComment,
        side: userType,
        time: new Date().toISOString(),
      });
      setNewComment(''); // Clear the input field
    }
  };

  return (
    <div className="comment-box">
      <h2>{subject}</h2>
      <p>Ticket for: {name}</p>

      <div className="comment-history">
        <h3>Comment History</h3>
        {comments.length > 0 ? (
          comments.map((comment, index) => (
            <div
              key={index}
              className={`comment-item ${comment.side === 'nurse' ? 'nurse' : 'qa'}`}
            >
              <p><strong>{comment.side === 'nurse' ? 'Nurse' : 'QA'}:</strong> {comment.comment}</p>
              <small>{new Date(comment.time).toLocaleString()}</small>
            </div>
          ))
        ) : (
          <p>No comments yet.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="comment-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows="4"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default CommentBox;