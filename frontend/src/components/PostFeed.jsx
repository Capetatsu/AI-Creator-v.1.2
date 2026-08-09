import PostCard from "./PostCard.jsx";

/**
 * Renders the list of posts, newest first.
 */
export default function PostFeed({ posts }) {
  // Sort by createdAt descending without mutating the original array.
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="post-feed">
      {sortedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
