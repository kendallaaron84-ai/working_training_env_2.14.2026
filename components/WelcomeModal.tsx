import React, { useEffect, useState } from 'react';
import { BIBLE_VERSES } from '../constants';
import { X, BookOpen } from 'lucide-react';

interface WelcomeModalProps {
  userName: string;
  userEmail?: string;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ userName, userEmail }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [verse, setVerse] = useState(BIBLE_VERSES[0]);

  // STRICT ACCESS CONTROL: Only for Corichia
  const isAuthorized = userEmail?.toLowerCase() === 'corichia@reelyfesolutions.com';

  useEffect(() => {
    // If not Corichia, do nothing
    if (!isAuthorized) return;

    const lastSeen = localStorage.getItem(`ramp_welcome_seen_${userName}`);
    const now = Date.now();
    const fourteenHours = 14 * 60 * 60 * 1000;

    if (!lastSeen || (now - parseInt(lastSeen)) > fourteenHours) {
      const randomVerse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
      setVerse(randomVerse);
      setIsOpen(true);
      localStorage.setItem(`ramp_welcome_seen_${userName}`, now.toString());
    }
  }, [userName, isAuthorized]);

  // Final Gate: If not open or not authorized, render nothing
  if (!isOpen || !isAuthorized) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-ramp-surface border-2 border-ramp-gold rounded-lg shadow-2xl max-w-lg w-full p-8 relative animate-fade-in">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <X size={24} />
        </button>

        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-ramp-gold/20 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-ramp-gold" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back, {userName}</h2>
          
          <div className="py-4">
            <p className="text-xl italic text-gray-700 dark:text-gray-300 font-serif">"{verse.text}"</p>
            <p className="mt-4 text-sm font-bold text-ramp-gold uppercase tracking-widest">— {verse.reference}</p>
          </div>

          <button 
            onClick={() => setIsOpen(false)}
            className="w-full bg-ramp-gold hover:bg-yellow-500 text-black font-bold py-3 rounded transition-colors"
          >
            Enter Portal
          </button>
        </div>
      </div>
    </div>
  );
};