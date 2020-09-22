
export function computeAge(dt: Date | null | undefined) : string {
    let cd: Date;
    if (!dt) {
        cd = getNow();
    }
    else {
        cd = new Date(dt);
    }
    let now = getNow();
    let age = getTimeAge(cd, now);
    return age;
}

export function getNow() : Date {
    let now: Date = new Date();
    let nowUTC: Date = new Date(now.toUTCString());
    return nowUTC;
}

export function getTimeAge(fromTime: Date, toTime: Date) {
    const secondMs: number = 1000;
    const minuteMs: number = secondMs * 60;
    const hourMs: number = minuteMs * 60;
    const dayMs: number = hourMs * 24;
    const weekMs: number = dayMs * 7
    const monthMs: number = dayMs * 30;
    const yearMs: number = dayMs * 365;

    let to = toTime.getTime();
    let from = fromTime.getTime();
    let diff = (to - from);
    let years = Math.floor(diff / yearMs);
    if (years >= 1) {
        return `${years} year${years > 1 ? 's' : ''} ago`
    }
    let days = Math.floor(diff / dayMs);
    if (days >= 1) {
        if (days > 30) {
            let months = Math.floor(days / monthMs);
            return `${months} month${months > 1 ? 's' : ''} ago`
        }
        else if (days > 7) {
            let weeks = Math.floor(days / weekMs);
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`
        }
        else {
            return `${days} day${days > 1 ? 's' : ''} ago`
        }
    }
    let hours = Math.floor(diff / hourMs);
    if (hours >= 1) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`
    }
    let minutes = Math.floor(diff / minuteMs);
    if (minutes >= 1) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    }
    let seconds = Math.floor(diff / secondMs);
    if (seconds >= 1) {
        return `${seconds} second${seconds > 1 ? 's' : ''} ago`
    }
    return 'just now'
}

function getLongMonth(date: Date) {
    let month = date.getMonth();
    if (month === 1) {
        return 'Jan';
    }
    else if (month === 2) {
        return 'Feb'
    }
    else if (month === 3) {
        return 'Mar';
    }
    else if (month === 4) {
        return 'Apr';
    }
    else if (month === 5) {
        return 'May';
    }
    else if (month === 6) {
        return 'Jun';
    }
    else if (month === 7) {
        return 'Jul';
    }
    else if (month === 8) {
        return 'Aug';
    }
    else if (month === 9) {
        return 'Sep';
    }
    else if (month === 10) {
        return 'Oct';
    }
    else if (month === 11) {
        return 'Nov';
    }
    else {
        return 'Dec';
    }
}

export function getLongDate(date: Date) {
    return `${date.getDate()} ${getLongMonth(date)} ${date.getFullYear()}`;
}