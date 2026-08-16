import { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

const PullToRefresh = ({ onRefresh, children }) => {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  
  const MAX_PULL = 80;
  const PULL_THRESHOLD = 60;

  const handleTouchStart = (e) => {
    if (containerRef.current.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling || refreshing) return;
    const y = e.touches[0].clientY;
    const distance = y - startY;
    
    if (distance > 0) {
      // Prevent default to avoid browser's native pull-to-refresh if any
      if (distance > 10 && e.cancelable) {
        e.preventDefault();
      }
      setCurrentY(Math.min(distance * 0.5, MAX_PULL)); // 0.5 friction
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    
    if (currentY >= PULL_THRESHOLD) {
      setRefreshing(true);
      setCurrentY(50); // Hold at 50px while refreshing
      
      // Execute the refresh callback
      Promise.resolve(onRefresh()).finally(() => {
        setRefreshing(false);
        setCurrentY(0);
      });
    } else {
      setCurrentY(0);
    }
    
    setIsPulling(false);
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        flex: 1, 
        overflowY: 'auto', 
        WebkitOverflowScrolling: 'touch',
        position: 'relative'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${currentY - 50}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease',
          opacity: currentY / PULL_THRESHOLD,
          zIndex: 10
        }}
      >
        <RefreshCw 
          className={refreshing ? 'fa-spin' : ''} 
          size={24} 
          color="var(--accent-gold)" 
          style={{ 
            transform: `rotate(${currentY * 2}deg)`,
            transition: isPulling ? 'none' : 'transform 0.3s ease'
          }} 
        />
      </div>
      
      <div 
        style={{ 
          transform: `translateY(${currentY}px)`, 
          transition: isPulling ? 'none' : 'transform 0.3s ease',
          minHeight: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
