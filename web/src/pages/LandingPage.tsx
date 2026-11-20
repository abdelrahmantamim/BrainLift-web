import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Sparkles, Target, Users, Zap, ChevronRight, Star, Check, Lock, Menu, X } from 'lucide-react';
import { featureFlagsService } from '@/services/featureFlags.service';

const LandingPage: React.FC = () => {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const checkFeatureFlags = async () => {
      try {
        const webLoginEnabled = await featureFlagsService.isWebLoginEnabled()
        setIsWebLoginEnabled(webLoginEnabled)
      } catch (error) {
        console.error('Error checking feature flags:', error)
        // Default to enabled if there's an error
        setIsWebLoginEnabled(true)
      } finally {
        // Feature flags loaded
      }
    }

    checkFeatureFlags()
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      const nav = document.querySelector('nav')
      if (isMobileMenuOpen && nav && !nav.contains(target)) {
        setIsMobileMenuOpen(false)
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isMobileMenuOpen])

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      return () => {
        document.removeEventListener('keydown', handleEscapeKey)
      }
    }
  }, [isMobileMenuOpen])
  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: "AI-Powered Learning",
      description: "Transform PDFs, images, and documents into interactive study materials instantly"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Spaced Repetition",
      description: "Science-backed algorithm ensures you remember what you learn long-term"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Share & Collaborate",
      description: "Share quizzes and flashcards with classmates via links or QR codes"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Smart AI Tutor",
      description: "Get instant explanations, solve problems, and understand complex topics"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Medical Student",
      content: "BrainLift transformed how I study. I can turn my lecture notes into interactive quizzes in seconds!",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "Language Learner",
      content: "The spaced repetition flashcards helped me memorize vocabulary 3x faster than traditional methods.",
      rating: 5
    },
    {
      name: "Emily Thompson",
      role: "High School Teacher",
      content: "I create custom quizzes for my students in minutes. It's been a game-changer for my classroom.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white prevent-horizontal-scroll">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                BrainLift
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-purple-600 transition">Features</a>
              <a href="#pricing" className="text-gray-700 hover:text-purple-600 transition">Pricing</a>
              <a href="#testimonials" className="text-gray-700 hover:text-purple-600 transition">Testimonials</a>
              <a href="#download" className="text-gray-700 hover:text-purple-600 transition">Download</a>
              {isWebLoginEnabled ? (
                <Link 
                  to="/auth/login" 
                  className="px-4 py-2 text-purple-600 hover:text-purple-700 font-medium"
                >
                  Sign In
                </Link>
              ) : (
                <div className="px-4 py-2 text-gray-400 font-medium flex items-center">
                  <Lock className="w-4 h-4 mr-1" />
                  Sign In Disabled
                </div>
              )}
              {isWebLoginEnabled ? (
                <Link 
                  to="/auth/register" 
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                >
                  Get Started
                </Link>
              ) : (
                <div className="px-4 py-2 bg-gray-400 text-white rounded-lg font-medium flex items-center cursor-not-allowed">
                  <Lock className="w-4 h-4 mr-1" />
                  Registration Disabled
                </div>
              )}
            </div>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-700 hover:text-purple-600 hover:bg-gray-100 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
          
          {/* Mobile Menu */}
          <div className={`md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md transition-all duration-300 ease-in-out overflow-hidden ${
            isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="px-2 pt-2 pb-3 space-y-1">
                <a 
                  href="#features" 
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-purple-600 hover:bg-gray-50 transition"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a 
                  href="#pricing" 
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-purple-600 hover:bg-gray-50 transition"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <a 
                  href="#testimonials" 
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-purple-600 hover:bg-gray-50 transition"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Testimonials
                </a>
                <a 
                  href="#download" 
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-purple-600 hover:bg-gray-50 transition"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Download
                </a>
                
                {/* Mobile Auth Buttons */}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  {isWebLoginEnabled ? (
                    <>
                      <Link 
                        to="/auth/login" 
                        className="block px-3 py-2 rounded-md text-base font-medium text-purple-600 hover:text-purple-700 hover:bg-gray-50 transition"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Sign In
                      </Link>
                      <Link 
                        to="/auth/register" 
                        className="block mx-3 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-center"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Get Started
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="block px-3 py-2 text-gray-400 font-medium flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        Sign In Disabled
                      </div>
                      <div className="mx-3 py-2 px-4 bg-gray-400 text-white rounded-lg font-medium text-center cursor-not-allowed flex items-center justify-center">
                        <Lock className="w-4 h-4 mr-2" />
                        Registration Disabled
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-8 sm:pt-12 lg:pt-20 pb-16 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="inline-flex items-center space-x-2 bg-purple-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                <span className="text-sm sm:text-base text-purple-700 font-medium">AI-Powered Learning Platform</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
              Study Smarter, Not Harder
              <span className="block bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                With AI-Powered Learning
              </span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              Turn your notes, PDFs, and documents into personalized quizzes and flashcards in seconds. 
              Join thousands of students achieving better grades with less effort.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              {isWebLoginEnabled ? (
                <Link 
                  to="/auth/register" 
                  className="px-6 sm:px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center group min-h-[48px] touch-manipulation"
                >
                  Start Learning Free
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <div className="px-6 sm:px-8 py-3 bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center cursor-not-allowed min-h-[48px]">
                  <Lock className="mr-2 w-5 h-5" />
                  Registration Currently Disabled
                </div>
              )}
              <a 
                href="#features" 
                className="px-6 sm:px-8 py-3 bg-white text-purple-600 rounded-lg border-2 border-purple-200 hover:border-purple-300 transition font-medium min-h-[48px] flex items-center justify-center touch-manipulation"
              >
                Explore Features
              </a>
            </div>
          </div>
          
          {/* App Preview */}
          <div className="mt-8 sm:mt-12 lg:mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 blur-3xl opacity-20"></div>
            <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl p-2 sm:p-3 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* Mobile Preview */}
                <div className="md:col-span-1 order-2 md:order-1">
                  <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-3 sm:p-4 h-[250px] sm:h-[350px] lg:h-[400px] flex flex-col items-center justify-center">
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 w-full max-w-[160px] sm:max-w-[200px]">
                      <div className="bg-purple-100 rounded-lg h-20 sm:h-32 mb-2 sm:mb-3 flex items-center justify-center">
                        <Brain className="w-8 h-8 sm:w-12 sm:h-12 text-purple-600" />
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="bg-gray-200 h-2 sm:h-3 rounded"></div>
                        <div className="bg-gray-200 h-2 sm:h-3 rounded w-3/4"></div>
                      </div>
                    </div>
                    <p className="text-purple-700 font-medium mt-3 sm:mt-4 text-xs sm:text-sm">Mobile App</p>
                  </div>
                </div>
                {/* Web Preview */}
                <div className="md:col-span-2 order-1 md:order-2">
                  <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-3 sm:p-4 h-[250px] sm:h-[350px] lg:h-[400px] flex flex-col items-center justify-center">
                    <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 w-full">
                      <div className="flex items-center space-x-1.5 sm:space-x-2 mb-3 sm:mb-4">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-400 rounded-full"></div>
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-400 rounded-full"></div>
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full"></div>
                      </div>
                      <div className="bg-purple-100 rounded-lg h-32 sm:h-48 mb-3 sm:mb-4 flex items-center justify-center">
                        <Brain className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" />
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="bg-gray-200 h-3 sm:h-4 rounded"></div>
                        <div className="bg-gray-200 h-3 sm:h-4 rounded w-5/6"></div>
                      </div>
                    </div>
                    <p className="text-purple-700 font-medium mt-3 sm:mt-4 text-xs sm:text-sm">Web App</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Features That Power Your Learning
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4 sm:px-0">
              Everything you need to study effectively and retain information longer
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-purple-50 rounded-xl p-4 sm:p-6 hover:shadow-lg transition group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600 rounded-lg flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm sm:text-base text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 bg-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">50K+</p>
              <p className="text-xs sm:text-sm lg:text-base text-purple-200">Active Students</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">2M+</p>
              <p className="text-xs sm:text-sm lg:text-base text-purple-200">Flashcards Created</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">500K+</p>
              <p className="text-xs sm:text-sm lg:text-base text-purple-200">Quizzes Taken</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">4.8/5</p>
              <p className="text-xs sm:text-sm lg:text-base text-purple-200">App Store Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              How BrainLift Works
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4 sm:px-0">
              Three simple steps to supercharge your learning
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-lg sm:text-2xl font-bold mx-auto mb-3 sm:mb-4">
                1
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Upload Your Materials</h3>
              <p className="text-sm sm:text-base text-gray-600 px-4 sm:px-0">
                Import PDFs, documents, images, or paste text directly. Works with any subject!
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-lg sm:text-2xl font-bold mx-auto mb-3 sm:mb-4">
                2
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">AI Creates Study Tools</h3>
              <p className="text-sm sm:text-base text-gray-600 px-4 sm:px-0">
                Advanced AI analyzes your content and generates perfect quizzes & flashcards
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-lg sm:text-2xl font-bold mx-auto mb-3 sm:mb-4">
                3
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Learn & Master</h3>
              <p className="text-sm sm:text-base text-gray-600 px-4 sm:px-0">
                Study with scientifically proven methods and track your improvement
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 lg:py-20 bg-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4 sm:px-0">
              Start free, upgrade when you need more
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border-2 border-gray-200">
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Free</h3>
              <p className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">$0<span className="text-base sm:text-lg font-normal text-gray-600">/month</span></p>
              <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">5 AI generations per day</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Basic quiz & flashcard features</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Share with friends</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Cross-device sync</span>
                </li>
              </ul>
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="block w-full text-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium min-h-[48px] flex items-center justify-center touch-manipulation">
                  Get Started
                </Link>
              ) : (
                <div className="block w-full text-center px-6 py-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed font-medium min-h-[48px] flex items-center justify-center">
                  Registration Disabled
                </div>
              )}
            </div>
            
            {/* Pro Plan */}
            <div className="bg-purple-600 rounded-xl p-6 sm:p-8 text-white relative">
              <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-semibold">
                MOST POPULAR
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Pro</h3>
              <p className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">$9.99<span className="text-base sm:text-lg font-normal opacity-80">/month</span></p>
              <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base">Unlimited AI generations</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base">Advanced AI models (GPT-4)</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base">PDF & image processing</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base">Priority support</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base">Export to PDF</span>
                </li>
              </ul>
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="block w-full text-center px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-medium min-h-[48px] flex items-center justify-center touch-manipulation">
                  Start Free Trial
                </Link>
              ) : (
                <div className="block w-full text-center px-6 py-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed font-medium min-h-[48px] flex items-center justify-center">
                  Registration Disabled
                </div>
              )}
            </div>
            
            {/* Team Plan */}
            <div className="bg-white rounded-xl p-6 sm:p-8 border-2 border-gray-200">
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Team</h3>
              <p className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6">$29.99<span className="text-base sm:text-lg font-normal text-gray-600">/month</span></p>
              <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Everything in Pro</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Up to 5 team members</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Shared content library</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Admin dashboard</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-gray-700">Analytics & insights</span>
                </li>
              </ul>
              <a href="mailto:team@getbrainlift.app" className="block w-full text-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium min-h-[48px] flex items-center justify-center touch-manipulation">
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Loved by Learners Worldwide
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4 sm:px-0">
              Join thousands who've transformed their study habits
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-purple-50 rounded-xl p-4 sm:p-6">
                <div className="flex mb-3 sm:mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4 italic">"{testimonial.content}"</p>
                <div>
                  <p className="text-sm sm:text-base font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-xs sm:text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="download" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-purple-600 to-purple-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-purple-100 mb-6 sm:mb-8 px-4 sm:px-0">
            Join BrainLift today and start studying smarter, not harder
          </p>
          <div className="flex flex-col gap-4 justify-center">
            {isWebLoginEnabled ? (
              <Link 
                to="/auth/register" 
                className="px-6 sm:px-8 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-medium flex items-center justify-center min-h-[48px] touch-manipulation mx-4 sm:mx-0"
              >
                Get Started Free
              </Link>
            ) : (
              <div className="px-6 sm:px-8 py-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed font-medium flex items-center justify-center min-h-[48px] mx-4 sm:mx-0">
                <Lock className="mr-2 w-5 h-5" />
                Registration Disabled
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <a 
                href="https://apps.apple.com/app/brainlift" 
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 sm:px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium flex items-center gap-2 min-h-[48px] touch-manipulation w-full sm:w-auto max-w-xs"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span className="text-sm sm:text-base">App Store</span>
              </a>
              <a 
                href="https://play.google.com/store/apps/details?id=com.brainlift.app" 
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 sm:px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium flex items-center gap-2 min-h-[48px] touch-manipulation w-full sm:w-auto max-w-xs"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                <span className="text-sm sm:text-base">Google Play</span>
              </a>
            </div>
          </div>
          <p className="text-xs sm:text-sm lg:text-base text-purple-200 mt-4 px-4 sm:px-0">
            Available on iOS, Android, and Web • Sync across all devices
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                <span className="text-xl sm:text-2xl font-bold text-white">BrainLift</span>
              </div>
              <p className="text-sm sm:text-base text-gray-400">
                Elevate your learning journey with AI-powered study tools.
              </p>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-3 sm:mb-4">Product</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li><a href="#features" className="text-sm sm:text-base hover:text-white transition">Features</a></li>
                <li>
                  {isWebLoginEnabled ? (
                    <Link to="/auth/register" className="text-sm sm:text-base hover:text-white transition">Get Started</Link>
                  ) : (
                    <span className="text-sm sm:text-base text-gray-500 cursor-not-allowed">Get Started</span>
                  )}
                </li>
                <li><a href="#pricing" className="text-sm sm:text-base hover:text-white transition">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-3 sm:mb-4">Company</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li><a href="/about" className="text-sm sm:text-base hover:text-white transition">About</a></li>
                <li><a href="/contact" className="text-sm sm:text-base hover:text-white transition">Contact</a></li>
                <li><a href="/blog" className="text-sm sm:text-base hover:text-white transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white mb-3 sm:mb-4">Legal</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li><a href="/privacy" className="text-sm sm:text-base hover:text-white transition">Privacy Policy</a></li>
                <li><a href="/terms" className="text-sm sm:text-base hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center">
            <p className="text-xs sm:text-sm">&copy; 2024 BrainLift. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;