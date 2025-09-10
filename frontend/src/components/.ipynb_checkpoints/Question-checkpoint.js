import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Shuffle, Settings, Mic, Keyboard, Moon, Sun, Menu as MenuIcon, X as CloseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from "axios";
import './Question.css'; // Import the CSS file
import SERVER_IP from "./Config";

interface Question {
    id: number;
    text: string;
    category: string;
    answer: string; // Add the correct answer
}

const sampleQuestions: Question[] = [
    { id: 1, text: 'What is the capital of France?', category: 'Geography', answer: 'Paris' },
    { id: 2, text: 'What is the highest mountain in the world?', category: 'Geography', answer: 'Mount Everest' },
    { id: 3, text: 'What is the largest planet in our solar system?', category: 'Astronomy', answer: 'Jupiter' },
    { id: 4, text: 'Who painted the Mona Lisa?', category: 'Art', answer: 'Leonardo da Vinci' },
    { id: 5, text: 'What is the chemical symbol for water?', category: 'Chemistry', answer: 'H2O' },
    { id: 6, text: 'What is the smallest country in the world?', category: 'Geography', answer: 'Vatican City' },
    { id: 7, text: 'What is the speed of light?', category: 'Physics', answer: '299,792,458 meters per second' },
    { id: 8, text: 'Who wrote Hamlet?', category: 'Literature', answer: 'William Shakespeare' },
    { id: 9, text: 'What is the currency of Japan?', category: 'Economics', answer: 'Japanese Yen' },
    { id: 10, text: 'What is the square root of 144?', category: 'Mathematics', answer: '12' },
];

// Function to calculate similarity (simplified for demonstration)


const QuestionnaireApp = () => {
    const [categories, setCategories] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [filteredQuestions, setFilteredQuestions] = useState('');
    const [userAnswer, setUserAnswer] = useState('');
    const [inputType, setInputType] = useState('text');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [score, setScore] = useState(null); // Initialize score as null
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const [submittedAnswer, setSubmittedAnswer] = useState();
    const answerInputRef = useRef(null); // ✅ remove <HTMLInputElement> if not using TypeScript
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    // Close menu when clicking outside (optional but good UX)
    // Note: This requires careful implementation if the menu itself has interactive elements.
    // A simpler approach is an overlay click or a close button.

    const handleMenuItemClick = (action) => {
        action(); // Execute the button's original function
        toggleMenu(); // Close the menu
    };

    const calculateSimilarity = async (answer1: string, answer2: string, questionid: string) => {
        const categoryData = {
            userAnswer: answer1,
            actualAnswer: answer2.replace(/<[^>]*>/g, "").trim(),
            questionId: questionid,
        };

        const response = await axios.post("{$SERVER_IP}/api/questions1/similaritycheck", categoryData, {
            headers: { "Content-Type": "application/json" },
        });

        if (response.data) {
            console.info("the data response", response.data);
            setScore(response.data);
            return response.data;
        }
        return;
    };

    const interpretSimilarity = (currentScore) => {
        // if (!isNaN(currentScore)) {
        const result = parseFloat(currentScore) * 100;
        console.log("Multiplied value:", result);

        if (result >= 90) return "Excellent – very close to the ideal answer.";
        if (result >= 75) return "Good – covers most key concepts.";
        if (result >= 60) return "Fair – some core points are missing.";
        if (result >= 40) return "Weak – limited alignment with the ideal response.";
        return "Poor – try to rethink or revise your answer.";
    };

    // Handle cases where filteredQuestions might be empty
    const currentQuestion = filteredQuestions[currentQuestionIndex] ?? null;

    const toggleInputType = () => {
        setInputType(inputType === 'text' ? 'speech' : 'text');
        setUserAnswer('');
        if (answerInputRef.current) {
            answerInputRef.current.focus();
        }
    };

    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

    useEffect(() => {
        document.body.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const submitAnswer = useCallback(async () => {
        if (currentQuestion && userAnswer.trim()) {
            try {
                const similarity = await calculateSimilarity(
                    userAnswer,
                    currentQuestion.answer,
                    filteredQuestions[currentQuestionIndex].questionId
                );
    
                console.log("similarity", similarity);
    
                setSubmittedAnswer({
                    userAnswer: userAnswer,
                    correctAnswer: currentQuestion.answer,
                    similarity: similarity,
                });
            } catch (error) {
                console.error("Error calculating similarity", error);
            }
        }
    }, [currentQuestion, userAnswer, filteredQuestions, currentQuestionIndex]);
    

    // Fetch categories and subcategories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesResponse = await fetch("{$SERVER_IP}/api/categories");
                const data = await categoriesResponse.json();
                setCategories(data);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };
        fetchCategories();
    }, []);

    const renderCategoryOptions = (categories, prefix = "") => {
        return categories.map((category) => (
            <React.Fragment key={category.categoryId}>
                <option value={category.categoryId}>{`${prefix}${category.name}`}</option>
                {category.subcategories &&
                    renderCategoryOptions(category.subcategories, `${prefix}--`)}
            </React.Fragment>
        ));
    };


    const handleNextQuestion = () => {
        //setSimilarityAvailable(false);
        setSubmittedAnswer();
        setUserAnswer('');

        const nextIndex =
            currentQuestionIndex < filteredQuestions.length - 1 ? currentQuestionIndex + 1 : 0;
        setCurrentQuestionIndex(nextIndex);
        readData(filteredQuestions[nextIndex].question); // Read the next question
    };


    const handlePreviousQuestion = () => {
        setSubmittedAnswer();
        setUserAnswer('');

        if (filteredQuestions.length > 0 && currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
            readData(filteredQuestions[currentQuestionIndex - 1].question); // Read the next question
        }
    };


    const handleRandomQuestion = () => {
        setSubmittedAnswer();
        setUserAnswer('');

        const allCategoryIds = collectCategoryIds(categories);
        const randomCategoryIdIndex = Math.floor(Math.random() * allCategoryIds.length);
        const randomCategoryId = allCategoryIds[randomCategoryIdIndex];
        setSelectedCategory(randomCategoryId)
    };

    const collectCategoryIds = (categories, collectedIds = []) => {
        categories.forEach((category) => {
            // Add the current categoryId to the array
            collectedIds.push(category.categoryId);

            // If there are subcategories, recursively collect their IDs
            if (category.subcategories) {
                collectCategoryIds(category.subcategories, collectedIds);
            }
        });
        return collectedIds;
    };


    // Fetch categories and subcategories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesResponse = await fetch("{$SERVER_IP}/api/categories");
                const data = await categoriesResponse.json();
                setCategories(data);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };
        fetchCategories();
    }, []);


    // Fetch questions for the selected category
    useEffect(() => {
        if (selectedCategory) {
            const fetchQuestions = async () => {
                try {
                    const questionsByCategoryResponse = await fetch(
                        `${SERVER_IP}/api/questions1/${selectedCategory}`
                    );
                    const data = await questionsByCategoryResponse.json();
                    setFilteredQuestions(data);
                    setCurrentQuestionIndex(0); // Reset to the first question
                    if (data.length > 0) {
                        readData(data[0].question); // Start reading the first question
                    }
                } catch (error) {
                    console.error("Error fetching questions:", error);
                }
            };
            fetchQuestions();
        }
    }, [selectedCategory]);

    // Text-to-Speech: Read the question out loud
    const readData = (data) => {
        const speech = new SpeechSynthesisUtterance(data);
        speech.lang = "en-US";
        window.speechSynthesis.speak(speech);

    };

    return (

        <div className="questionnaire-container">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="questionnaire-motion-wrapper"            >
                <div className="questionnaire-card">
                    <div className="questionnaire-title-bar">

                        <button
                            onClick={toggleMenu}
                            className="hamburger-button"
                            title="Open Menu"
                            aria-label="Open Menu"
                        >
                            <MenuIcon className="icon-medium" />
                        </button>

                        <span className="questionnaire-title-text">🎯 Questionnaire</span>

                        <button
                            onClick={toggleDarkMode}
                            className="dark-mode-toggle" // Use class

                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {isDarkMode ? <Sun className="icon-medium" /> : <Moon className="icon-medium" />} {/* Use class */}

                        </button>

                    </div>
                    <h3 className="questionnaire-counter">
                        Question {currentQuestionIndex + 1}/{filteredQuestions.length}
                    </h3>
                    <div className="questionnaire-instruction">
                        Answer the question below.
                    </div>
                    <div className="category-select-wrapper">
                        <select
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            value={selectedCategory}
                            className="category-select" // Use class

                        >
                            <option value="">Select Category</option>
                            {renderCategoryOptions(categories)}

                        </select>
                    </div>

                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentQuestion?.id ?? 'empty'}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="question-display-wrapper"
                        >
                            <div className="question-text-container">
                                <p className="question-text">
                                    {currentQuestion ? currentQuestion.question : 'No questions available.'}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <div className="answer-input-row">
                        <textarea
                            ref={answerInputRef}
                            type={inputType === 'text' ? 'text' : 'text'} // Keep as text for now
                            placeholder={inputType === 'text' ? 'Type your answer...' : 'Speak your answer...'}
                            value={userAnswer}
                            onChange={(e) => {
                                setUserAnswer(e.target.value);
                                e.target.style.height = 'auto'; // reset height
                                //  e.target.style.height = e.target.scrollHeight + 'px'; // set to content height

                            }
                            }
                            className="answer-input auto-resize-textarea"
                            rows={1} // starts small
                        />
                        {  /*  <button
                            onClick={toggleInputType}
                                                                 className="submit-button" // Use class

                            title={inputType === 'text' ? "Switch to Speech Input" : "Switch to Text Input"}
                        >
                            {inputType === 'text' ? <Mic style={{ width: '1.5rem', height: '1.5rem' }} /> : <Keyboard style={{ width: '1.5rem', height: '1.5rem' }} />}
                        </button> */}
                        <button
                            onClick={submitAnswer}
                            disabled={!userAnswer.trim()}
                            className="submit-button" // Use class

                        >
                            Submit
                        </button>
                    </div>

                    {submittedAnswer && (
                        <div className="submitted-answer-container">
                            <h3 className="submitted-answer-heading">Your Answer:</h3>
                            <p className="submitted-answer-text">{submittedAnswer.userAnswer}</p>
                            <h3 className="submitted-answer-heading">Correct Answer:</h3>
                            <p dangerouslySetInnerHTML={{ __html: submittedAnswer.correctAnswer }}
                                className="submitted-answer-text">


                            </p>
                            <h4 className="similarity-score-heading">
                                Similarity Score: <span className="similarity-score-value">{submittedAnswer.similarity}%</span><br />
                                <span className="similarity-interpretation">
                                    {interpretSimilarity(score)}
                                </span>
                            </h4>

                        </div>
                    )}

                    <div className="navigation-buttons-row">
                        <button
                            onClick={handlePreviousQuestion}
                            disabled={filteredQuestions.length === 0 || currentQuestionIndex === 0}
                            className="nav-button prev-button"
                        >
                            <ArrowLeft className="icon-small" />
                            Previous
                        </button>
                        <button
                            onClick={handleNextQuestion}
                            disabled={filteredQuestions.length === 0 || currentQuestionIndex === filteredQuestions.length - 1}
                            className="nav-button next-button"
                        >
                            Next
                            <ArrowRight className="icon-small" />
                        </button>
                        <button
                            onClick={handleRandomQuestion}
                            // disabled={filteredQuestions.length === 0}
                            className="nav-button random-button" // Use classes

                        >
                            <Shuffle className="icon-small" />
                            Random
                        </button>
                    </div>

                </div>
            </motion.div>


            {/* Hamburger Menu Drawer */}
            <AnimatePresence>
                {isMenuOpen && (
                    <>
                        {/* Overlay (no changes needed here) */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="menu-overlay"
                            onClick={toggleMenu}
                        />

                        {/* Menu Drawer - UPDATE THIS SECTION */}
                        <motion.div
                            initial={{ x: '-100%' }} // Start off-screen LEFT
                            animate={{ x: 0 }}        // Slide in to position 0
                            exit={{ x: '-100%' }}      // Slide out to the LEFT
                            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
                            className="menu-drawer" // CSS class remains the same
                        >
                            {/* Menu content (header, nav) remains the same */}
                            <div className="menu-header">
                                <h3>Menu</h3>
                                <button onClick={toggleMenu} className="close-menu-button" title="Close Menu" aria-label="Close Menu">
                                    <CloseIcon className="icon-medium" />
                                </button>
                            </div>
                            <nav className="menu-nav">
                                <button
                                    onClick={() => handleMenuItemClick(handlePreviousQuestion)}
                                    className="menu-item menu-button"
                                >
                                    Manage Categories
                                </button>
                                <button
                                    onClick={() => handleMenuItemClick(handlePreviousQuestion)}
                                    className="menu-item menu-button"
                                >
                                    Manage Questions
                                </button>

                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={isDarkMode}
                                        onChange={(toggleDarkMode)}
                                    />
                                    <span className="slider" />
                                    <span className="switch-label">Dark Theme</span>
                                </label>

                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default QuestionnaireApp;

