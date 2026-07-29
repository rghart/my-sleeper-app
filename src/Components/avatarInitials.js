// The avatar's initials, shared by the top bar and the drawer footer so the
// two can't drift apart. First two initials of a multi-word display name,
// uppercased; the first two characters for a single-word one; and an empty
// string - never "undefined" - when there is no name at all.
export const avatarInitials = (name) => {
    if (!name) {
        return '';
    }
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return '';
    }
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
};
