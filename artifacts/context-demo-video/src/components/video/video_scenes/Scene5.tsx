import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const bars = [
    { width: 16, opacity: 0.32 },
    { width: 24, opacity: 0.46 },
    { width: 32, opacity: 0.60 },
    { width: 40, opacity: 0.74 },
    { width: 48, opacity: 0.88 },
    { width: 48, opacity: 1, color: '#6366F1' }, // Bottom widest bar in solid indigo
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 1 }}
    >
      <div className="flex flex-col items-center justify-center gap-6">
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-end justify-end gap-[6px]">
            {bars.map((bar, i) => (
              <motion.div
                key={i}
                className="h-2 rounded-full"
                style={{ 
                  width: `${bar.width}px`, 
                  backgroundColor: bar.color || '#FFFFFF',
                  opacity: bar.color ? 1 : bar.opacity 
                }}
                initial={{ scaleX: 0, originX: 1 }}
                animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
              />
            ))}
          </div>
          
          <motion.div 
            className="text-6xl font-semibold tracking-tight text-white"
            initial={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
            animate={phase >= 2 ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: -20, filter: 'blur(10px)' }}
            transition={{ duration: 0.8 }}
          >
            Context
          </motion.div>
        </div>

        <motion.div
          className="text-[#6366F1] font-mono tracking-widest text-sm uppercase mt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}
        >
          Understand why. Instantly.
        </motion.div>
      </div>
    </motion.div>
  );
}