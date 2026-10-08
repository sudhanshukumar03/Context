import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2500),
      setTimeout(() => setPhase(5), 4500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
        {/* Main Alert */}
        <motion.div 
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-2xl w-full shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col items-start gap-4"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-3 h-3 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-red-400 font-mono text-sm tracking-wider font-semibold">CRITICAL ALERT</span>
            <span className="text-white/40 font-mono text-sm ml-auto">14:02:11 UTC</span>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-white">payment-service latency p99 &gt; 8000ms</h2>
        </motion.div>

        {/* Cascading Alerts */}
        <div className="flex justify-center gap-4 mt-6 w-full max-w-4xl">
          {['auth-service: timeout', 'db-pool: exhausted', 'checkout: failing'].map((alert, i) => (
            <motion.div
              key={alert}
              className="bg-[#111520] border border-white/5 rounded-md p-4 flex-1 flex flex-col gap-2"
              initial={{ opacity: 0, y: 30 }}
              animate={phase >= i + 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-orange-400 font-mono text-xs">WARNING</span>
              </div>
              <p className="text-sm font-mono text-white/80">{alert}</p>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Background ambient red pulse */}
      <motion.div 
        className="absolute inset-0 bg-red-500/5 mix-blend-screen pointer-events-none"
        animate={{ opacity: [0, 0.2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}