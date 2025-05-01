import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, Mail } from "lucide-react";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const auth = getAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Fetch user role and data from Firestore
      const userRef = doc(firestore, "users", user.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        throw new Error("User data not found");
      }

      const userData = userSnapshot.data();

      // Store user role and basic info in localStorage for easier access
      localStorage.setItem("userRole", userData.role);
      localStorage.setItem("userName", userData.name);
      localStorage.setItem("userEmail", userData.email);

      // Redirect based on role
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      setError(
        error.message || "Failed to log in. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="w-full max-w-lg px-4 mt-16">
        <Card className="shadow-xl border-indigo-200 overflow-hidden">
          <CardHeader className="space-y-1 bg-gradient-to-r from-indigo-700 to-purple-600 text-white">
            <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
            <CardDescription className="text-center text-indigo-100">
              Enter your credentials to access the consultation management system
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6 bg-white">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-indigo-500 mr-2" />
                  <label className="text-sm font-medium text-indigo-900">Email</label>
                </div>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-indigo-200 focus:border-indigo-400 focus:ring-indigo-300"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <Lock className="h-4 w-4 text-indigo-500 mr-2" />
                  <label className="text-sm font-medium text-indigo-900">Password</label>
                </div>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-indigo-200 focus:border-indigo-400 focus:ring-indigo-300"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Logging in...
                  </div>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="bg-indigo-50 p-4 border-t border-indigo-100">
            <p className="text-sm text-center w-full text-indigo-600">
              Secure login portal for healthcare professionals
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;