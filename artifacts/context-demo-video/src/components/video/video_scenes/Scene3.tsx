import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 5000),
      setTimeout(() => setPhase(5), 7500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 1 }}
    >
      {/* Indigo glow background */}
      <motion.div 
        className="absolute inset-0 bg-[#6366F1]/5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />
      
      <div className="max-w-3xl w-full p-12 relative z-10 flex flex-col gap-8">
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
        >
          <motion.div 
            className="w-4 h-4 bg-[#6366F1] rounded-sm"
            animate={{ rotate: [0, 90, 180, 270, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
          <span className="text-[#6366F1] font-mono tracking-widest text-sm uppercase">Context is analyzing...</span>
        </motion.div>

        <div className="flex flex-col gap-4 border-l-2 border-[#6366F1]/30 pl-6 py-2">
          {phase >= 2 && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-white/60 font-mono text-lg"
            >
              db-pool connection exhaustion
            </motion.div>
          )}
          {phase >= 3 && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-white/80 font-mono text-xl flex items-center gap-3"
            >
              <span className="text-[#6366F1]">→</span> auth-service timeouts
            </motion.div>
          )}
          {phase >= 4 && (
            <motion.div 
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              className="text-white font-medium text-3xl flex items-center gap-3 mt-2"
            >
              <span className="text-[#6366F1]">→</span> payment cascade
            </motion.div>
          )}
        </div>
        
        {phase >= 4 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 inline-block bg-[#6366F1]/10 text-[#6366F1] px-4 py-2 rounded-md font-mono text-sm self-start border border-[#6366F1]/30"
          >
            Root cause identified
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}