import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import nft1 from '../assets/nft1.png';
import nft2 from '../assets/nft2.png';
import nft3 from '../assets/nft3.png';

const nfts = [
  { img: nft1, title: 'CYBORG SAMURAI', rarity: 'LEGENDARY', color: '#ffffff' },
  { img: nft2, title: 'NEBULA ORB', rarity: 'EPIC', color: '#ffffff' },
  { img: nft3, title: 'GOLDEN ENTITY', rarity: 'RARE', color: '#ffffff' },
];

export default function ThreeDCarousel() {
  const [index, setIndex] = useState(0);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [10, -10]), { stiffness: 100, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-10, 10]), { stiffness: 100, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % nfts.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      className="relative w-full h-[500px] md:h-[700px] flex items-center justify-center perspective-[2000px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-x-0 h-px bg-white/10 top-1/2 -translate-y-1/2" />
      <div className="absolute inset-y-0 w-px bg-white/10 left-1/2 -translate-x-1/2" />
      
      <motion.div
        style={{ rotateX, rotateY }}
        className="relative w-[300px] h-[400px] md:w-[450px] md:h-[600px] preserve-3d"
      >
        <AnimatePresence mode="popLayout">
          {nfts.map((nft, i) => {
            const isActive = i === index;
            const diff = i - index;
            const offset = diff === 0 ? 0 : diff > 0 ? 1 : -1;
            
            if (!isActive && Math.abs(diff) > 1 && Math.abs(diff) !== nfts.length - 1) return null;

            return (
              <motion.div
                key={nft.title}
                initial={{ opacity: 0, scale: 0.8, z: -500 }}
                animate={{
                  opacity: isActive ? 1 : 0.2,
                  scale: isActive ? 1 : 0.8,
                  z: isActive ? 0 : -200,
                  x: isActive ? 0 : offset * 350,
                  rotateY: isActive ? 0 : offset * -30,
                  filter: isActive ? 'grayscale(0%)' : 'grayscale(100%)',
                }}
                exit={{ opacity: 0, scale: 0.5, z: -500 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                className="absolute inset-0 rounded-2xl overflow-hidden bg-black border border-white/10"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <img 
                  src={nft.img} 
                  alt={nft.title} 
                  className="w-full h-full object-cover select-none transition-all duration-1000"
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-8 md:p-12">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 10 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase mb-4">
                      {nft.rarity} ASSET
                    </p>
                    <h3 className="text-4xl md:text-5xl font-light tracking-tighter text-white mb-6">
                      {nft.title}
                    </h3>
                    <div className="h-px w-full bg-white/10 mb-6" />
                    <div className="flex justify-between items-center text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">
                      <span>GENESIS PROTOCOL</span>
                      <span>EDITION 001/001</span>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Navigation Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
        {nfts.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`w-2 h-2 rounded-full transition-all duration-500 border ${
              i === index ? 'bg-white border-white scale-125' : 'bg-transparent border-white/20 hover:border-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}


