import React, { useState, useRef, useEffect, use } from 'react';
import {
  collection,
  addDoc,
  doc,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
} from "firebase/firestore";

import { firestore } from "../../firebase";
import { Send, SendHorizontal } from "lucide-react";

const formatTime = (date) => {
  if (!date) return "";
  if (!(date instanceof Date)) {
    return new Date(date.toDate()).toLocaleString(
      "en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    )
  }
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const CommentBox = ({ ticketItem, userType }) => {
  const [comments, setComments] = useState(ticketItem.comments || []);
  const [newComment, setNewComment] = useState('');
  const [ticketRef, setTicketRef] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const ticketRef = doc(firestore, "tickets", ticketItem.id);
    setTicketRef(ticketRef);
  }, [ticketItem]);

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const handleSendComment = () => {
    if (newComment.trim() === '') {
      return;
    }

    const commentToAdd = {
      comment: newComment,
      side: userType,
      time: new Date(),
    };

    const commentsArray = [...comments, commentToAdd]
    setComments(commentsArray);
    updateDoc(ticketRef, {
      comments: commentsArray
    })

    setNewComment('');
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendComment();
    }
  };

  return (
    <div className="flex flex-col h-full w-full mx-auto bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Header Section */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">{ticketItem.subject}</h2>
        <p className="text-sm text-gray-500">Clinic: {ticketItem.name}</p>
      </div>

      {/* Comments History Section */}
      <div className="flex-1 max-h-96 p-4 overflow-y-auto bg-gray-50">
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
      <div className="p-4 bg-white border-t border-gray-200 rounded-b-xl">
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
