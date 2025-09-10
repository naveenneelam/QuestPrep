import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Moon, Sun, Menu as MenuIcon, X as CloseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './Question.css'; // Import the CSS file
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css"; // Include Quill's CSS
import SERVER_IP from "./Config";

const QuestionnaireApp = () => {
    const [categories, setCategories] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [filteredQuestions, setFilteredQuestions] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [categoryName, setCategoryName] = useState("");
    const [customAnswer, setcustomAnswer] = useState("");

    const [customText, setCustomText] = useState("");


    const [creationType, setCreationType] = useState('subCategory'); // Default to subCategory
  


    const categoryNameInputRef = useRef(null); // ✅ remove <HTMLInputElement> if not using TypeScript
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);


    const handleMenuItemClick = (action) => {
        action(); // Execute the button's original function
        toggleMenu(); // Close the menu
    };


    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

    useEffect(() => {
        document.body.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);



    // Fetch categories and subcategories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesResponse = await fetch("${SERVER_IP}/api/categories");
                const data = await categoriesResponse.json();
                setCategories(data);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };
        fetchCategories();
    }, []);



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
                        `{$SERVER_IP}/api/questions1/${selectedCategory}`
                    );
                    const data = await questionsByCategoryResponse.json();
                    setFilteredQuestions(data);
                    setCurrentQuestionIndex(0); // Reset to the first question

                } catch (error) {
                    console.error("Error fetching questions:", error);
                }
            };
            fetchQuestions();
        }
    }, [selectedCategory]);



    // Recursive function to render categories and subcategories as options
    const renderCategoryOptions = (categories, prefix = "") => {
        return categories.map((category) => (
            <React.Fragment key={category.categoryId}>
                <option value={category.categoryId}>{`${prefix}${category.name}`}</option>
                {category.subcategories &&
                    renderCategoryOptions(category.subcategories, `${prefix}--`)}
            </React.Fragment>
        ));
    };



    const handleCategoryChange = (event) => {
        const categoryId = event.target.value;
        const findCategoryById = (categories, categoryId) => {
            for (const category of categories) {
                if (category.categoryId === categoryId) {
                    return category;
                }
                if (category.subcategories) {
                    const found = findCategoryById(category.subcategories, categoryId);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        };

        const selected = findCategoryById(categories, categoryId);
        //const selected = categories.find((cat) => cat.categoryId === categoryId);
        setSelectedCategory(categoryId);
        setCategoryName(selected ? selected.name : "");
    };

    const saveCategory = async (selectedCategory, category) => {
        try {
            const response = await fetch("{$SERVER_IP}/api/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parentId: selectedCategory ?? null,
                    name: category

                }),
            });

            if (!response.ok) {
                throw new Error("Failed to submit the categoryName.");
            }

            console.log("category submitted successfully.");
        } catch (error) {
            console.error("Error submitting category:", error);
        }
    };
  // Submit the user's answer to the backend
  const saveQuestionAnswer = async (selectedCategory, answer, customAnswer) => {
    try {
      const response = await fetch("{$SERVER_IP}/api/questions1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory,
          question: answer,
          answer: customAnswer

        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit the answer.");
      }

      console.log("Answer submitted successfully.");
    } catch (error) {
      console.error("Error submitting answer:", error);
    }
  };

    const handleSubmit = () => {
        if (!selectedCategory || !customText) {
            alert("Please select a category and enter text.");
            return;
          }
          saveQuestionAnswer(selectedCategory, customText, customAnswer);
          setCustomText(""); // Reset custom text after submission
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

                        <span className="questionnaire-title-text">Manage Q & A
                        </span>

                        <button
                            onClick={toggleDarkMode}
                            className="dark-mode-toggle" // Use class

                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {isDarkMode ? <Sun className="icon-medium" /> : <Moon className="icon-medium" />} {/* Use class */}

                        </button>

                    </div>


                    {/* --- Creation Type Radio Group --- 
                    <div className="form-field-group">
                         <div className="radio-option">
                            <input
                                type="radio"
                                id="createTopLevel"
                                name="creationType"
                                value="topLevel"
                                checked={creationType === 'topLevel'}
                                onChange={handleTypeChange}
                            />
                            <label htmlFor="createTopLevel">Create Top-Level Category</label>
                        </div>
                        <div className="radio-option">
                            <input
                                type="radio"
                                id="createSubCategory"
                                name="creationType"
                                value="subCategory"
                                checked={creationType === 'subCategory'}
                                onChange={handleTypeChange}
                            />
                            <label htmlFor="createSubCategory">Create Subcategory</label>
                        </div>
                    </div>
                    */}
                    {/* --- Parent Category Selection (Conditional) --- */}
                    {creationType === 'subCategory' && (
                        <div className="form-field-group">
                            <label htmlFor="parentCategory" className="form-label">Select Category</label>
                            <select
                                className="category-select" // Use class
                                id="category-dropdown"
                                onChange={handleCategoryChange}
                                value={selectedCategoryId}
                            >
                                <option value="" disabled>
                                    Select a category
                                </option>
                                {renderCategoryOptions(categories)}
                            </select>
                        </div>
                    )}

                    <div >
                        <label htmlFor="custom-text" style={{
                            display: "block",
                            marginBottom: "8px",
                            color: "#555",
                            fontWeight: "bold",
                        }}>
                            Enter Question:
                        </label>
                        <input
                            id="custom-text"
                            type="text"
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="Enter your question here"
                            className="answer-input" // Reuse text input style

                        />
                    </div>

                    <div >
                        <label htmlFor="answer" style={{
                            display: "block",
                            marginBottom: "8px",
                            color: "#555",
                            fontWeight: "bold",
                        }} >
                            Enter Answer:
                        </label>
                        <ReactQuill value={customAnswer} onChange={setcustomAnswer}
                        />

                    </div>

                    <div className="answer-input-row">


                        <button
                            onClick={handleSubmit}
                            disabled={!customAnswer.trim()}
                            className="submit-button" // Use class
                        >
                            Submit
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
                                    className="menu-item menu-button"
                                >
                                    Manage Categories
                                </button>
                                <button
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

