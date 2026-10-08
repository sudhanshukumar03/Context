import { useEffect, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS: Record<string, number> = {
  chaos: 6000,
  cascade: 8000,
  ai_activates: 9000,
  postmortem: 8000,
  logo: 6000,
};

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  chaos: Scene1,
  cascade: Scene2,
  ai_activates: Scene3,
  postmortem: Scene4,
  logo: Scene5,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#080c14] text-white">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      {/* Global Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#080c14_100%)] opacity-80 z-50"></div>

      {/* Ambient persistent glow */}
      <motion.div
        className="absolute rounded-full blur-[100px] pointer-events-none"
        animate={{
          x: sceneIndex >= 2 ? '50vw' : '10vw',
          y: sceneIndex >= 2 ? '30vh' : '20vh',
          width: sceneIndex >= 2 ? '600px' : '300px',
          height: sceneIndex >= 2 ? '600px' : '300px',
          backgroundColor: sceneIndex >= 2 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(239, 68, 68, 0.1)',
          opacity: sceneIndex === 4 ? 0 : 1,
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
        style={{ transform: 'translate(-50%, -50%)' }}
      />

      <AnimatePresence initial={false} mode="wait">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
