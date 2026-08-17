export const updateGlobalBadge = () => {
  const c1 = localStorage.getItem('badge_comm') === 'true';
  const c2 = localStorage.getItem('badge_cons') === 'true';
  if (c1 || c2) {
    if (navigator.setAppBadge) navigator.setAppBadge().catch(() => {});
  } else {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  }
};
