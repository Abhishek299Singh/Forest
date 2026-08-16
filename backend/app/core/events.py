import asyncio
import json
from typing import Set, Dict, Any
from datetime import datetime, timezone

class EventBus:
    def __init__(self):
        self.subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.subscribers.discard(queue)

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        payload = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        message = json.dumps(payload)
        for queue in list(self.subscribers):
            try:
                await queue.put(message)
            except Exception:
                self.subscribers.discard(queue)

event_bus = EventBus()
