import "./App.css";
import Footer from "./components/Footer";
import Menu from "./components/Menu";
import Index from "./pages/Index";
import Login from "./pages/Login";
import TeacherCourses from "./pages/TeacherCourses";
import TeacherUpload from "./pages/TeacherUpload";
import TeacherStudents from "./pages/TeacherStudents";
import TeacherResults from "./pages/TeacherResults";
import StudentTasks from "./pages/StudentTasks";
import RecommendationsPage from "./pages/RecommendationsPage";
import { Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import StudentTest from "./pages/StudentTest";
import StudentAccess from "./pages/StudentAccess";


function App() {
    const [highlight, setHighlight] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("theme");
        if (saved === "dark") document.body.classList.add("dark");
        else document.body.classList.remove("dark");
    }, []);

    return (
        <AuthProvider>
            <div className="app-background">
                <Menu setHighlight={setHighlight} />

                <Routes>
                    <Route path="/" element={<Index highlight={highlight} />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/teacher/courses" element={<TeacherCourses />} />
                    <Route path="/teacher/upload" element={<TeacherUpload />} />
                    <Route path="/teacher/students" element={<TeacherStudents />} />
                    <Route path="/teacher/results" element={<TeacherResults />} />
                    <Route path="/student/tasks" element={<StudentTasks />} />
                    <Route path="/recommendations" element={<RecommendationsPage />} />
                    <Route path="/student/test" element={<StudentTest />} />
                    <Route path="/student" element={<StudentAccess />} />
                </Routes>

                <Footer setHighlight={setHighlight} />
            </div>
        </AuthProvider>
    );
}

export default App;
