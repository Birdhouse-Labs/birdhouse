// ABOUTME: Python code sample for syntax highlighting demo
// ABOUTME: Demonstrates classes, decorators, type hints, and dataclasses

import type { CodeSample } from "./types";

export const python: CodeSample = {
  id: "python",
  name: "Python",
  language: "python",
  description: "A meeting scheduler that understands the pain of calendar Tetris",
  code: `"""A meeting scheduler that respects your will to live."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import random


class MeetingType(Enum):
    """Types of meetings, ranked by existential threat level."""
    STANDUP = "standup"  # Could've been an email
    PLANNING = "planning"  # Could've been a shorter meeting
    RETRO = "retro"  # Therapy, but make it corporate
    ONE_ON_ONE = "1:1"  # Actually useful sometimes
    ALL_HANDS = "all_hands"  # Time to catch up on Slack


@dataclass
class Meeting:
    title: str
    meeting_type: MeetingType
    duration_minutes: int
    attendees: list[str] = field(default_factory=list)
    could_be_email: bool = True
    
    @property
    def suffering_index(self) -> float:
        """Calculate how much this meeting will drain your soul."""
        base = self.duration_minutes / 60
        attendee_penalty = len(self.attendees) ** 0.5
        type_multiplier = {
            MeetingType.STANDUP: 0.5,
            MeetingType.ONE_ON_ONE: 0.3,
            MeetingType.RETRO: 0.8,
            MeetingType.PLANNING: 1.2,
            MeetingType.ALL_HANDS: 2.0,
        }
        return base * attendee_penalty * type_multiplier[self.meeting_type]


class Calendar:
    def __init__(self, owner: str):
        self.owner = owner
        self.meetings: list[tuple[datetime, Meeting]] = []
        self._sanity_remaining = 100.0
    
    def schedule(self, start: datetime, meeting: Meeting) -> bool:
        """Attempt to schedule a meeting. May cause despair."""
        if self._sanity_remaining <= 0:
            raise RuntimeError(f"{self.owner} has mass-resigned from meetings")
        
        # Check for conflicts (there are always conflicts)
        for existing_time, existing in self.meetings:
            if self._overlaps(start, meeting, existing_time, existing):
                print(f"Conflict detected. Consider async communication?")
                return False
        
        self.meetings.append((start, meeting))
        self._sanity_remaining -= meeting.suffering_index
        return True
    
    def _overlaps(
        self, 
        t1: datetime, m1: Meeting,
        t2: datetime, m2: Meeting
    ) -> bool:
        end1 = t1 + timedelta(minutes=m1.duration_minutes)
        end2 = t2 + timedelta(minutes=m2.duration_minutes)
        return not (end1 <= t2 or end2 <= t1)
    
    def suggest_focus_time(self) -> Optional[datetime]:
        """Find time to do actual work. Results may vary."""
        # This is left as an exercise for the reader
        # (just like your actual focus time)
        return None


if __name__ == "__main__":
    cal = Calendar("Exhausted Engineer")
    
    standup = Meeting(
        title="Daily Standup",
        meeting_type=MeetingType.STANDUP,
        duration_minutes=15,
        attendees=["everyone", "even the intern"],
        could_be_email=True,
    )
    
    cal.schedule(datetime.now(), standup)
    print(f"Sanity remaining: {cal._sanity_remaining:.1f}%")`,
};
