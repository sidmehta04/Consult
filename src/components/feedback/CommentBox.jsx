import React, { useState, useRef, useEffect } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";

import { firestore } from "../../firebase";
import { Send, SendHorizontal } from "lucide-react";

// Using an SVG for the send icon for self-containment
const SendIcon = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 2 11 13" />
    <path d="m22 2-7 20-4-9-9-4 20-7z" />
  </svg>
);


/**
 * Formats a date object into a readable string (e.g., "6/15/2024, 10:30 AM")
 * @param {Date} date - The date object to format
 * @returns {string} - The formatted date string
 */
const formatTime = (date) => {
    if (!date || !(date instanceof Date)) {
        return '';
    }
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};


/**
 * A component to display a chat-like comment history and allow for new comments.
 * @param {{
 * ticketItem: {
 * subject: string,
 * name: string,
 * comments: Array<{
 * comment: string,
 * side: 'nurse' | 'qa',
 * time: Date
 * }>
 * },
 * userType: 'nurse' | 'qa'
 * }} props
 */
const CommentBox = ({ ticketItem, userType }) => {
  // State to hold the current list of comments. Initialize with prop data.
  const [comments, setComments] = useState(ticketItem.comments || []);
  // State for the new comment text being typed by the user.
  const [newComment, setNewComment] = useState('');
  
  // Ref to the end of the messages list to enable auto-scrolling
  const messagesEndRef = useRef(null);

  // Function to scroll to the latest message smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to the bottom whenever the comments array is updated
  useEffect(() => {
    scrollToBottom();
  }, [comments]);


  /**
   * Handles the submission of a new comment.
   */
  const handleSendComment = () => {
    // Trim the comment to ensure it's not just whitespace
    if (newComment.trim() === '') {
      return; // Don't send empty comments
    }

    // Create the new comment object
    const commentToAdd = {
      comment: newComment,
      side: userType, // The sender is the current user
      time: new Date(), // Timestamp the comment now
    };

    // Update the comments state with the new comment
    setComments([...comments, commentToAdd]);
    // Clear the input field
    setNewComment('');
  };

  /**
   * Allows sending the message by pressing 'Enter'
   * @param {React.KeyboardEvent<HTMLTextAreaElement>} event
   */
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevents adding a new line
      handleSendComment();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Header Section */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">{ticketItem.subject}</h2>
        <p className="text-sm text-gray-500">Clinic: {ticketItem.name}</p>
      </div>

      {/* Comments History Section */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="space-y-4">
          {comments.map((msg, index) => {
            const isCurrentUser = msg.side === userType;
            return (
              <div
                key={index}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-end max-w-md">
                   {/* Avatar Placeholder */}
                   {!isCurrentUser && (
                     <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3 flex-shrink-0">
                       <span className="text-sm font-bold text-gray-600">{msg.side.charAt(0).toUpperCase()}</span>
                     </div>
                   )}
                  <div
                    className={`rounded-lg px-4 py-2 shadow-sm ${
                      isCurrentUser
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-200 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm">{msg.comment}</p>
                    <p className={`text-xs mt-1 ${ isCurrentUser ? 'text-blue-100' : 'text-gray-500'} text-right`}>
                        {formatTime(msg.time)}
                    </p>
                  </div>
                   {/* Avatar Placeholder */}
                   {isCurrentUser && (
                     <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center ml-3 flex-shrink-0">
                       <span className="text-sm font-bold text-white">{msg.side.charAt(0).toUpperCase()}</span>
                     </div>
                   )}
                </div>
              </div>
            );
          })}
          {/* Empty div to mark the end of the messages for auto-scrolling */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* New Comment Input Section */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <textarea
            className="flex-1 w-full p-2 text-sm text-gray-700 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="2"
            placeholder="Type your message..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button
            onClick={handleSendComment}
            disabled={!newComment.trim()}
            className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            aria-label="Send comment"
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentBox;
