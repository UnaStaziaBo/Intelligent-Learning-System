import React, { useState } from "react";
import "./TeacherCourses.css";
import { useNavigate } from "react-router-dom";

const STUDENT_COURSES = [
    { id: 1, title: "APS", description: "Skupina pondelok 7.30" },
    { id: 2, title: "OOP", description: "Skupina pondelok 9.10" },
    { id: 4, title: "OS", description: "Skupina utorok 7.30" },
    { id: 5, title: "ÚŠaA", description: "Skupina štvrtok 9.10" },
];

const StudentCourses = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const normalizedSearch = search.trim().toLowerCase();
    const filteredCourses = STUDENT_COURSES.filter((course) =>
        course.title.toLowerCase().includes(normalizedSearch) ||
        course.description.toLowerCase().includes(normalizedSearch)
    );

    const openCourse = (id) => {
        navigate(`/recommendations`);
    };

    return (
        <div className="section teacher-courses-section">
            <div className="teacher-courses-panel">
                <h2 className="teacher-courses-title">
                    Vyberte kurz
                </h2>

                <div className="teacher-courses-search-wrapper">
                    <input
                        className="teacher-courses-search"
                        placeholder="Hľadať názov kurzu"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="teacher-courses-grid">
                    {filteredCourses.length === 0 ? (
                        <p className="teacher-courses-empty">
                            Nenašli sme žiadny kurz podľa zadaného názvu.
                        </p>
                    ) : (
                        filteredCourses.map((course) => (
                            <button
                                key={course.id}
                                className="teacher-course-card"
                                onClick={() => openCourse(course.id)}
                            >
                                <h3>{course.title}</h3>
                                <p>{course.description}</p>
                            </button>
                        ))
                    )}
                </div>

                <div className="teacher-courses-footer">
                    <button
                        className="teacher-courses-home-btn"
                        onClick={() => navigate("/")}
                    >
                        Hlavná stránka
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentCourses;
