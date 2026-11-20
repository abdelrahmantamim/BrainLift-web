# API Field Selection

The BrainLift API supports field selection to reduce payload sizes and improve performance. This allows clients to request only the specific fields they need.

## How to Use

### Query Parameter Method
Add a `fields` query parameter with comma-separated field names:

```
GET /api/chat/history?fields=id,title,created_at
GET /api/quiz/list?fields=id,title,difficulty,question_count
GET /api/files/list?fields=id,filename,file_type,created_at
```

### Header Method
Use the `X-Fields` header:

```
X-Fields: id,name,email,avatar_url
```

## Examples

### 1. Get User Profile (Minimal Fields)
```bash
GET /api/user/profile?fields=id,name,avatar_url

Response:
{
  "id": "123",
  "name": "John Doe",
  "avatar_url": "https://..."
}
```

### 2. Get Chat History (Selected Fields)
```bash
GET /api/chat/history?fields=id,title,created_at&page=1&limit=10

Response:
{
  "conversations": [
    {
      "id": "conv-1",
      "title": "Math Help",
      "created_at": "2024-01-20T10:00:00Z"
    },
    {
      "id": "conv-2",
      "title": "Science Quiz",
      "created_at": "2024-01-19T15:30:00Z"
    }
  ],
  "totalCount": 50,
  "page": 1,
  "limit": 10
}
```

### 3. Nested Field Selection
```bash
GET /api/quiz/456?fields=id,title,questions.id,questions.text

Response:
{
  "id": "456",
  "title": "Physics Quiz",
  "questions": [
    {
      "id": "q1",
      "text": "What is Newton's first law?"
    },
    {
      "id": "q2",
      "text": "Calculate the velocity..."
    }
  ]
}
```

## Mobile App Usage

### React Native Example
```typescript
// utils/api.ts
export const fetchWithFields = async (url: string, fields: string[]) => {
  const response = await api.get(url, {
    params: {
      fields: fields.join(',')
    }
  });
  return response.data;
};

// Usage in component
const sessions = await fetchWithFields('/chat/history', [
  'id',
  'title',
  'created_at'
]);
```

### Performance Benefits

1. **Reduced Bandwidth**: Only requested fields are sent
2. **Faster Parsing**: Less data to process on client
3. **Lower Memory Usage**: Smaller objects in memory
4. **Better User Experience**: Faster load times

## Default Behavior

If no fields are specified, the API returns all fields (current behavior).

## Error Handling

- Invalid field names are ignored
- At least one valid field must be returned
- Error responses are not affected by field selection

## Recommendations

1. **List Views**: Use minimal fields (id, title, date)
2. **Detail Views**: Request all needed fields
3. **Mobile**: Always use field selection to save bandwidth
4. **Caching**: Cache different field sets separately