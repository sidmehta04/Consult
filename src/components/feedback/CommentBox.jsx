import React, { useState, useRef, useEffect } from 'react';
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
import { Send, Building, MapPin, Activity, User, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { categories, subcategories } from "./mappings";

const formatTime = (date) => {
  if (!date) return "";
  if (!(date instanceof Date)) {
    return new Date(date.toDate()).toLocaleString("en-US", {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric', 
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusColors = {
  "open": "bg-red-100 text-red-800 border-red-200",
  "in-progress": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "resolved": "bg-green-100 text-green-800 border-green-200",
  "closed": "bg-gray-100 text-gray-800 border-gray-200",
};

const CommentBox = ({ ticketItem, userType }) => {
  const [comments, setComments] = useState(ticketItem.comments || []);
  const [newComment, setNewComment] = useState('');
  const [ticketRef, setTicketRef] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
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

  const handleSendComment = async () => {
    if (newComment.trim() === '' || isSending) {
      return;
    }

    setIsSending(true);

    const commentToAdd = {
      comment: newComment,
      side: userType,
      time: new Date(),
    };

    const commentsArray = [...comments, commentToAdd];
    setComments(commentsArray);
    
    try {
      await updateDoc(ticketRef, {
        comments: commentsArray,
        lastUpdatedAt: new Date()
      });
      setNewComment('');
    } catch (error) {
      console.error("Error sending comment:", error);
      // Revert optimistic update on error
      setComments(comments);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendComment();
    }
  };

  const getIssueLabels = () => {
    try {
      const issue = categories.find((item) => item.value === ticketItem.issue)?.label.split(' | ')[0] || ticketItem.issue;
      const subissue = subcategories[ticketItem.issue]?.find((item) => item.value === ticketItem.subIssue)?.label.split(' | ')[0] || ticketItem.subIssue;
      return { issue, subissue };
    } catch (error) {
      return { issue: ticketItem.issue, subissue: ticketItem.subIssue };
    }
  };

  const { issue, subissue } = getIssueLabels();

  return (
    <div className="flex flex-col h-[80vh] w-full max-w-4xl mx-auto bg-white">
      {/* Header Section */}
      <CardHeader className="pb-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {issue}
            </h2>
            <p className="text-gray-600 font-medium">{subissue}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700">{ticketItem.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-600">{ticketItem.clinicCode}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">{ticketItem.state}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <Badge className={`${statusColors[ticketItem.status]} font-medium`}>
                {ticketItem.status?.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Messages Section */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-blue-50/30">
        <div className="p-6 space-y-6">
          {comments.map((msg, index) => {
            const isCurrentUser = msg.side === userType;
            
            return (
              <div
                key={index}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-end max-w-lg">
                  {/* Avatar for other user */}
                  {!isCurrentUser && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-md">
                      <span className="text-sm font-bold text-white">
                        {msg.side === 'nurse' ? 'N' : 'Q'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    {/* Message bubble */}
                    <div
                      className={`px-4 py-3 shadow-md ${
                        isCurrentUser
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-md'
                          : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-blue-100'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.comment}</p>
                    </div>
                    
                    {/* Timestamp */}
                    <div className={`mt-1 px-2 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                      <span className="text-xs text-gray-500">
                        {formatTime(msg.time)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Avatar for current user */}
                  {isCurrentUser && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center ml-3 flex-shrink-0 shadow-md">
                      <span className="text-sm font-bold text-white">
                        {msg.side === 'nurse' ? 'N' : 'Q'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Section */}
      <div className="p-6 bg-white border-t border-blue-100">
        <div className="flex items-end space-x-4">
          <div className="flex-1">
            <textarea
              className="w-full p-4 text-sm text-gray-700 border-2 border-blue-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-blue-50/50"
              rows="3"
              placeholder="Type your message here..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending}
            />
            <div className="flex justify-between items-center mt-2 px-2">
              <span className="text-xs text-blue-600">
                Press Enter to send, Shift+Enter for new line
              </span>
              <span className={`text-xs ${newComment.length > 500 ? 'text-red-500' : 'text-blue-500'}`}>
                {newComment.length}/1000
              </span>
            </div>
          </div>
          
          <Button
            onClick={handleSendComment}
            disabled={!newComment.trim() || isSending}
            className="h-14 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-2xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {isSending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Sending
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Send
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommentBox;