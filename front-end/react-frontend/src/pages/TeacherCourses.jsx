import React, { useState } from "react";
import "./TeacherCourses.css";
import { useNavigate } from "react-router-dom";

const COURSES = [
    { id: 1, title: "Formálne jazyky (FJ)", description: "Skupina pondelok 7.30" },
    { id: 2, title: "Formálne jazyky (FJ)", description: "Skupina pondelok 9.10" },
    { id: 3, title: "Formálne jazyky (FJ)", description: "Skupina pondelok 10.50" },
    { id: 4, title: "Formálne jazyky (FJ)", description: "Skupina utorok 9.10" },
    { id: 5, title: "Formálne jazyky (FJ)", description: "Skupina utorok 10.50" },
    { id: 6, title: "Princípy počítačového inžinierstva (PPI)", description: "Skupina pondelok 13.30" },
    { id: 7, title: "Princípy počítačového inžinierstva (PPI)", description: "Skupina pondelok 15.10" },
    { id: 8, title: "Princípy počítačového inžinierstva (PPI)", description: "Skupina utorok 7.30" },
];

const TeacherCourses = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const openCourse = (id) => {
        navigate(`/teacher/upload?course=${id}`);
    };

    const normalizedSearch = search.trim().toLowerCase();
    const filteredCourses = COURSES.filter((course) =>
        course.title.toLowerCase().includes(normalizedSearch)
    );

    return (
        <div className="section teacher-courses-section">
            <div className="teacher-courses-panel">
                <h2 className="teacher-courses-title">Vyberte kurz</h2>

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

export default TeacherCourses;