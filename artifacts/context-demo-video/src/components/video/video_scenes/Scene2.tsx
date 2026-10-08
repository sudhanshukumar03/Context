import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),  // nodes appear
      setTimeout(() => setPhase(2), 1200), // db fails
      setTimeout(() => setPhase(3), 2000), // auth fails
      setTimeout(() => setPhase(4), 2800), // payment fails
      setTimeout(() => setPhase(5), 3600), // checkout fails
      setTimeout(() => setPhase(6), 6500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const nodes = [
    { id: 'db', label: 'db-pool', x: '50vw', y: '65vh' },
    { id: 'auth', label: 'auth-service', x: '35vw', y: '45vh' },
    { id: 'payment', label: 'payment-service', x: '65vw', y: '45vh' },
    { id: 'checkout', label: 'checkout-service', x: '50vw', y: '25vh' },
  ];

  const getStatusColor = (id: string) => {
    if (id === 'db' && phase >= 2) return '#EF4444';
    if (id === 'auth' && phase >= 3) return '#EF4444';
    if (id === 'payment' && phase >= 4) return '#EF4444';
    if (id === 'checkout' && phase >= 5) return '#EF4444';
    return '#334155';
  };

  const isFailed = (id: string) => {
    if (id === 'db' && phase >= 2) return true;
    if (id === 'auth' && phase >= 3) return true;
    if (id === 'payment' && phase >= 4) return true;
    if (id === 'checkout' && phase >= 5) return true;
    return false;
  };

  return (
    <motion.div 
      className="absolute inset-0"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0">
        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* db to auth */}
          <motion.line x1="50vw" y1="65vh" x2="35vw" y2="45vh" stroke={phase >= 3 ? '#EF4444' : '#334155'} strokeWidth="2" strokeDasharray="4 4" 
            initial={{ pathLength: 0 }} animate={{ pathLength: phase >= 1 ? 1 : 0 }} transition={{ duration: 1 }} />
          {/* db to payment */}
          <motion.line x1="50vw" y1="65vh" x2="65vw" y2="45vh" stroke={phase >= 4 ? '#EF4444' : '#334155'} strokeWidth="2" strokeDasharray="4 4"
            initial={{ pathLength: 0 }} animate={{ pathLength: phase >= 1 ? 1 : 0 }} transition={{ duration: 1 }} />
          {/* auth to checkout */}
          <motion.line x1="35vw" y1="45vh" x2="50vw" y2="25vh" stroke={phase >= 5 ? '#EF4444' : '#334155'} strokeWidth="2" strokeDasharray="4 4"
            initial={{ pathLength: 0 }} animate={{ pathLength: phase >= 1 ? 1 : 0 }} transition={{ duration: 1 }} />
          {/* payment to checkout */}
          <motion.line x1="65vw" y1="45vh" x2="50vw" y2="25vh" stroke={phase >= 5 ? '#EF4444' : '#334155'} strokeWidth="2" strokeDasharray="4 4"
            initial={{ pathLength: 0 }} animate={{ pathLength: phase >= 1 ? 1 : 0 }} transition={{ duration: 1 }} />
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            className="absolute flex flex-col items-center gap-2 transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: node.x, top: node.y }}
            initial={{ opacity: 0, scale: 0 }}
            animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <motion.div 
              className="w-16 h-16 rounded-xl border-2 flex items-center justify-center bg-[#080c14] relative"
              animate={{ 
                borderColor: getStatusColor(node.id),
                boxShadow: isFailed(node.id) ? '0 0 30px rgba(239,68,68,0.4)' : '0 0 0px rgba(0,0,0,0)'
              }}
              transition={{ duration: 0.3 }}
            >
              {isFailed(node.id) && (
                <motion.div 
                  className="absolute inset-0 bg-red-500/20 rounded-xl"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                />
              )}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: getStatusColor(node.id) }}>
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </motion.div>
            <span className="font-mono text-sm" style={{ color: getStatusColor(node.id) }}>{node.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}