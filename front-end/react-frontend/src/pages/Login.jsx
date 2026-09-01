import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Login.css";
import { useAuth } from "../context/AuthContext";

const Login = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();

    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const role = params.get("role");


    const tokenOtp = params.get("token");

    const [step, setStep] = useState(1);

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [taskCode, setTaskCode] = useState("");

    useEffect(() => {
        if (tokenOtp) {
            setOtp(tokenOtp);
            setStep(2);
        }
    }, [tokenOtp]);

    const goAfterStudentFlow = (finalTaskCode) => {

        const qs = new URLSearchParams();
        if (finalTaskCode) qs.set("task", finalTaskCode);

        navigate(`/recommendations?${qs.toString()}`);
    };

    const goAfterLogin = () => {
        if (role === "teacher") return navigate("/teacher/upload");
        if (role === "student") return goAfterStudentFlow(taskCode);
        return navigate("/");
    };

    const handleEmailSubmit = (e) => {
        e.preventDefault();

        if (!email.includes("@")) {
            alert("Zadajte platný email.");
            return;
        }

        // TODO: backend call to send OTP to the email
        console.log("Send OTP to:", email, "role:", role);

        setStep(2);
    };

    const handleOtpSubmit = (e) => {
        e.preventDefault();

        if (otp.trim().length < 4) {
            alert("Zadajte overovací kód.");
            return;
        }

        // TODO: backend call to verify OTP (email + otp) or (tokenOtp)
        console.log("Verify OTP:", { email, otp, role });


        login({
            email: email || "",
            role: role || "guest",
            // TODO: later store userId, studentId, etc.
        });

        if (role === "student") setStep(3);
        else goAfterLogin();
    };

    const handleTaskCodeSubmit = (e) => {
        e.preventDefault();

        if (taskCode.trim().length < 3) {
            alert("Zadajte kód zadania.");
            return;
        }

        // TODO: backend call to resolve taskCode -> analysisId/recommendations
        console.log("Task code submitted:", { email, taskCode });

        goAfterStudentFlow(taskCode.trim());
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <h2 className="login-title">
                    Prihlásenie{" "}
                    {role === "teacher" ? "pedagóga" : role === "student" ? "študenta" : ""}
                </h2>

                {step === 1 && (
                    <>
                        <p className="login-subtitle">
                            Zadajte email. Pošleme vám overovací kód.
                        </p>

                        <form onSubmit={handleEmailSubmit}>
                            <input
                                className="input-field"
                                type="email"
                                placeholder="Email:"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <button className="login-button" type="submit">
                                Pokračovať
                            </button>
                        </form>
                    </>
                )}

                {step === 2 && (
                    <>
                        <p className="login-subtitle">
                            Zadajte overovací kód, ktorý sme zaslali na:
                            <br />
                            <strong>{email || "váš email"}</strong>
                        </p>

                        <form onSubmit={handleOtpSubmit}>
                            <input
                                className="input-field"
                                type="text"
                                placeholder="Overovací kód"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                            />

                            <button className="login-button" type="submit">
                                Overiť
                            </button>
                        </form>

                        <button
                            type="button"
                            className="resend-button"
                            onClick={() => alert("Kód odoslaný znovu!")}
                            disabled={!email.includes("@")}
                            title={!email.includes("@") ? "Najprv zadajte email" : "Znova poslať kód"}
                        >
                            Preposlať mail
                        </button>

                        <button
                            type="button"
                            className="resend-button"
                            onClick={() => setStep(1)}
                        >
                            Zmeniť email
                        </button>
                    </>
                )}

                {step === 3 && (
                    <>
                        <p className="login-subtitle">
                            Zadajte kód zadania (kód listu)
                        </p>

                        <form onSubmit={handleTaskCodeSubmit}>
                            <input
                                className="input-field"
                                type="text"
                                placeholder="Kód zadania"
                                value={taskCode}
                                onChange={(e) => setTaskCode(e.target.value)}
                                required
                            />

                            <button className="login-button" type="submit">
                                Pokračovať
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default Login;
