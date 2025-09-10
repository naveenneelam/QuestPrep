import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Question from "./components/Question.js";
import QCreateCategory from "./components/QCreateCategory.js";
import QCreateQA from "./components/QCreateQA.js";
import Livetrans from "./components/Livetrans.js";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/qcreateqa" element={<QCreateQA />} />
        <Route path="/" element={<Question />} />
        <Route path="/qcreatecategory" element={<QCreateCategory />} />
        <Route path="/livetrans" element={<Livetrans />} />

    </Routes>
    </Router>
  );
}

export default App;