import React, { useState } from "react";
import "./Walkthrough.css";

import step1 from "../assets/walkthrough/student/student_step1.png";
import step2 from "../assets/walkthrough/student/student_step2.png";
import step3 from "../assets/walkthrough/student/student_step3.png";
import step4 from "../assets/walkthrough/student/student_step4.png";
import step5 from "../assets/walkthrough/student/student_step5.png";
import step6 from "../assets/walkthrough/student/student_step6.png";

const slides = [
    {
        title: "Krok 1: Zadajte svoje údaje",
        text: "Vitajte v systéme, ktorý predstavuje nástroj na prípravu na opravný test.",
        img: step1,
    },
    {
        title: "Krok 2: Odpovedzte na otázky riadneho testu",
        text: "Najprv odpovedzte na otázky, ktoré by ste riešili pri riadnom teste v Moodle.",
        img: step2,
    },
    {
        title: "Krok 3: Pozrite si svoje výsledky",
        text: "Zapamätajte si témy, ktoré spôsobujú ťažkosti, a začnite proces generovania.",
        img: step3,
    },
    {
        title: "Krok 4: Pripravte sa na opravu",
        text: "Budú vytvorené materiály, ktoré pomôžu pri opravnom teste Moodle. Informácie o témach, v ktorých boli chyby, nájdete v pdf súbore.",
        img: step4,
    },
    {
        title: "Krok 5: Vykonajte úlohy na upevnenie vedomostí",
        text: "Snažte sa podrobne odpovedať na otázky a vypracovať k nim dodatočné úlohy.",
        img: step5,
    },
    {
        title: "Krok 6: Prečítajte si správnu odpoveď a ohodnoťte sa",
        text: "Pri hodnotení 8–10 sa úloha označí ako splnená. V opačnom prípade je potrebné odpovedať na otázku opakovane. Snažte sa naučiť čo najviac.",
        img: step6,
    },
];

const StudentWalkthrough = ({ onClose }) => {
    const [step, setStep] = useState(0);
    const slide = slides[step];
    const isLast = step === slides.length - 1;

    return (
        <div className="walkthrough-overlay">
            <div className="walkthrough-card">

                <div className="walkthrough-header">
                    Návod na používanie
                </div>

                <img src={slide.img} alt="" />
                <h3>{slide.title}</h3>
                <p>{slide.text}</p>

                <div className="walkthrough-actions">
                    {!isLast ? (
                        <button onClick={() => setStep((s) => s + 1)}>
                            Ďalej
                        </button>
                    ) : (
                        <button onClick={onClose}>
                            Začať
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentWalkthrough;
