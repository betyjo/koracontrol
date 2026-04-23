"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose: () => void;
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
    const bgColor = {
        success: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
    }[type];

    const Icon = {
        success: CheckCircle,
        error: XCircle,
        info: Info
    }[type];

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${bgColor} transition-colors duration-500`}
        >
            <Icon size={20} className="shrink-0" />
            <p className="text-sm font-bold tracking-tight">{message}</p>
            <button 
                onClick={onClose}
                className="ml-auto p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                aria-label="Close"
            >
                <X size={14} />
            </button>
        </motion.div>
    );
}
