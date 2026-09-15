# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

# Isolates the two storage patterns unique to ProtocolCourt.py that no
# prior project of this user's has deployed through real GenVM:
#   1. a DynArray[T] field inside an @allow_storage dataclass, nested
#      inside another @allow_storage dataclass that is itself a TreeMap value
#   2. TreeMap[str, DynArray[str]] as a *direct* contract-level field
#      (not wrapped in a dataclass)


@allow_storage
class Item:
    item_id: str
    label: str

    def __init__(self, item_id: str, label: str):
        self.item_id = item_id
        self.label = label


@allow_storage
class Bucket:
    bucket_id: str
    items: DynArray[Item]

    def __init__(self, bucket_id: str):
        self.bucket_id = bucket_id


class DiagNestedStorage(gl.Contract):
    buckets: TreeMap[str, Bucket]
    tags: TreeMap[str, DynArray[str]]

    def __init__(self):
        pass

    @gl.public.write
    def create_bucket(self, bucket_id: str) -> str:
        self.buckets[bucket_id] = Bucket(bucket_id=bucket_id)
        return bucket_id

    @gl.public.write
    def add_item(self, bucket_id: str, item_id: str, label: str) -> str:
        bucket = self.buckets[bucket_id]
        bucket.items.append(Item(item_id=item_id, label=label))
        return item_id

    @gl.public.write
    def tag(self, key: str, value: str) -> None:
        if key not in self.tags:
            self.tags[key] = []
        self.tags[key].append(value)

    @gl.public.view
    def get_bucket_item_count(self, bucket_id: str) -> u256:
        return u256(len(self.buckets[bucket_id].items))

    @gl.public.view
    def get_tags(self, key: str) -> list[str]:
        vals = self.tags.get(key)
        return [] if vals is None else [v for v in vals]
