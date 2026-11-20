import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { flashcardService } from '@/services/flashcard.service';
import { useFlashcardStore } from '@/store/flashcardStore';
import toast from 'react-hot-toast';

interface CardEntry {
  question: string;
  answer: string;
}

const emptyCard = (): CardEntry => ({ question: '', answer: '' });

export const FlashcardCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { fetchDecks } = useFlashcardStore();
  const [deckName, setDeckName] = useState('');
  const [category, setCategory] = useState('general');
  const [cards, setCards] = useState<CardEntry[]>([emptyCard(), emptyCard()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addCard = () => {
    if (cards.length >= 20) {
      toast.error('Maximum 20 cards per deck');
      return;
    }
    setCards([...cards, emptyCard()]);
  };

  const removeCard = (index: number) => {
    if (cards.length <= 1) return;
    setCards(cards.filter((_, i) => i !== index));
  };

  const updateCard = (index: number, field: keyof CardEntry, value: string) => {
    const updated = [...cards];
    updated[index] = { ...updated[index], [field]: value };
    setCards(updated);
  };

  const handleSubmit = async () => {
    if (!deckName.trim()) {
      toast.error('Please enter a deck name');
      return;
    }

    const validCards = cards.filter(c => c.question.trim() && c.answer.trim());
    if (validCards.length === 0) {
      toast.error('Add at least one card with both question and answer');
      return;
    }

    setIsSubmitting(true);
    try {
      await flashcardService.createFlashcards({
        title: deckName.trim(),
        description: category,
        cards: validCards,
      });
      toast.success('Flashcard deck created!');
      await fetchDecks();
      navigate('/flashcards');
    } catch {
      toast.error('Failed to create flashcard deck');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filledCount = cards.filter(c => c.question.trim() && c.answer.trim()).length;

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="pg-card shadow-clay-coral p-6 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/flashcards')}
                className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-pg-navy" />
              </button>
              <div>
                <h1 className="text-2xl font-heading font-bold text-pg-coral">
                  Create Flashcards
                </h1>
                <p className="text-pg-text-secondary font-body text-sm">Add your own question and answer pairs</p>
              </div>
            </div>
          </div>

          {/* Deck Info */}
          <div className="pg-card shadow-clay-teal p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-body font-medium text-pg-navy mb-2">Deck Name *</label>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="e.g., Biology Chapter 5"
                className="input-auth"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-body font-medium text-pg-navy mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-auth"
              >
                <option value="general">General</option>
                <option value="science">Science</option>
                <option value="math">Math</option>
                <option value="history">History</option>
                <option value="language">Language</option>
                <option value="programming">Programming</option>
              </select>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-4 mb-6">
            {cards.map((card, index) => {
              const cardColors = ['coral', 'teal', 'yellow', 'lilac'];
              const cardColor = cardColors[index % cardColors.length];
              return (
                <div key={index} className={`pg-card shadow-clay-${cardColor} p-5 group`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-pg-text-secondary font-body">
                      <GripVertical className="w-4 h-4" />
                      <span className="text-sm font-medium">Card {index + 1}</span>
                    </div>
                    {cards.length > 1 && (
                      <button
                        onClick={() => removeCard(index)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-pg-text-secondary hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-pg-text-secondary font-body mb-1">Question / Front</label>
                      <textarea
                        value={card.question}
                        onChange={(e) => updateCard(index, 'question', e.target.value)}
                        placeholder="Enter question..."
                        rows={2}
                        className="input-auth resize-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-pg-text-secondary font-body mb-1">Answer / Back</label>
                      <textarea
                        value={card.answer}
                        onChange={(e) => updateCard(index, 'answer', e.target.value)}
                        placeholder="Enter answer..."
                        rows={2}
                        className="input-auth resize-none text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Card Button */}
          <button
            onClick={addCard}
            disabled={cards.length >= 20}
            className="w-full p-4 pg-card shadow-clay-lilac hover:bg-pg-cream transition-all duration-200 flex items-center justify-center gap-2 text-pg-text-secondary hover:text-pg-navy font-body disabled:opacity-50 disabled:cursor-not-allowed mb-8"
          >
            <Plus className="w-5 h-5" />
            Add Card ({cards.length}/20)
          </button>

          {/* Submit */}
          <div className="pg-card shadow-clay-yellow p-6 flex items-center justify-between">
            <p className="text-sm text-pg-text-secondary font-body">
              {filledCount} card{filledCount !== 1 ? 's' : ''} ready
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/flashcards')}
                className="pg-btn pg-btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !deckName.trim() || filledCount === 0}
                className="pg-btn pg-btn-coral disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Deck'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
