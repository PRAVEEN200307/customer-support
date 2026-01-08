// src/pages/auth/VerifyEmail.js
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineMail } from 'react-icons/hi';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        const response = await authAPI.verifyEmail(token);
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
        toast.success('Email verified successfully!');
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Verification failed');
        toast.error('Email verification failed');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              status === 'verifying' ? 'bg-blue-100' :
              status === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {status === 'verifying' && (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              )}
              {status === 'success' && (
                <HiOutlineCheckCircle className="w-8 h-8 text-green-600" />
              )}
              {status === 'error' && (
                <HiOutlineXCircle className="w-8 h-8 text-red-600" />
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900">
              {status === 'verifying' && 'Verifying Email...'}
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Failed'}
            </h1>
            
            <p className="text-gray-600 mt-2 text-center">
              {status === 'verifying' && 'Please wait while we verify your email address.'}
              {status === 'success' && message}
              {status === 'error' && message}
            </p>
          </div>

          {status !== 'verifying' && (
            <div className="mt-6 space-y-4">
              {status === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <HiOutlineCheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-green-800">
                      Your email has been successfully verified. You can now access all features.
                    </span>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <HiOutlineXCircle className="h-5 w-5 text-red-600 mr-2" />
                    <span className="text-red-800">
                      The verification link may have expired or is invalid. Please request a new verification email.
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <HiOutlineMail className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-blue-800">
                    If you encounter any issues, please contact our support team.
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  to="/login"
                  className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;