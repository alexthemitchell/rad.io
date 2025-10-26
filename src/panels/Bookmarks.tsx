import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveRegion } from "../hooks/useLiveRegion";
import { formatFrequency } from "../utils/frequency";
import { generateBookmarkId } from "../utils/id";

/**
 * Bookmarks panel/page for frequency management
 *
 * Purpose: Save and organize frequencies with metadata, tags, and usage tracking
 *
 * Features:
 * - Bookmark list with search and filter
 * - One-click tuning (navigates to Monitor page)
 * - Add/edit/delete bookmarks
 * - Tags and categories
 * - LocalStorage persistence
 *
 * Success criteria:
 * - Supports 10k+ entries
 * - Full-text search <100ms (PRD)
 *
 * TODO: Add import/export functionality (future)
 * TODO: Migrate to IndexedDB for better performance with 10k+ entries
 */

interface Bookmark {
  id: string;
  frequency: number; // Hz
  name: string;
  tags: string[];
  notes: string;
  createdAt: number; // timestamp
  lastUsed: number; // timestamp
}

interface BookmarksProps {
  isPanel?: boolean; // True when rendered as a side panel, false for full-page route
}

const STORAGE_KEY = "rad.io:bookmarks";

function Bookmarks({ isPanel = false }: BookmarksProps): React.JSX.Element {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    frequency?: string;
    name?: string;
  }>({});
  const [formData, setFormData] = useState({
    frequency: "",
    name: "",
    tags: "",
    notes: "",
  });

  const navigate = useNavigate();
  const { announce } = useLiveRegion();

  // Load bookmarks from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Bookmark[];
        setBookmarks(parsed);
      } catch {
        // Invalid data, ignore
      }
    }
  }, []);

  // Save bookmarks to localStorage
  const saveBookmarks = (newBookmarks: Bookmark[]): void => {
    setBookmarks(newBookmarks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
  };

  // Precompute searchable text for each bookmark, memoizing per-bookmark to avoid redundant formatting
  const prevSearchTextMapRef = useRef<
    Map<string, { searchText: string; bookmark: Bookmark }>
  >(new Map());
  const searchableBookmarks = useMemo(() => {
    const newMap = new Map<
      string,
      { searchText: string; bookmark: Bookmark }
    >();
    for (const b of bookmarks) {
      const prev = prevSearchTextMapRef.current.get(b.id);
      // Only recompute if relevant fields changed
      if (
        prev &&
        prev.bookmark.name === b.name &&
        prev.bookmark.notes === b.notes &&
        prev.bookmark.frequency === b.frequency &&
        JSON.stringify(prev.bookmark.tags) === JSON.stringify(b.tags)
      ) {
        newMap.set(b.id, prev);
      } else {
        const searchText = [
          b.name,
          ...b.tags,
          b.notes,
          formatFrequency(b.frequency),
        ]
          .join(" ")
          .toLowerCase();
        newMap.set(b.id, { searchText, bookmark: b });
      }
    }
    prevSearchTextMapRef.current = newMap;
    return Array.from(newMap.values());
  }, [bookmarks]);

  // Filter and search bookmarks using precomputed searchText
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery) {
      // Return original bookmarks array for compatibility
      return bookmarks;
    }
    const query = searchQuery.toLowerCase();
    return searchableBookmarks
      .filter((sb) => sb.searchText.includes(query))
      .map((sb) => sb.bookmark);
  }, [searchableBookmarks, bookmarks, searchQuery]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const handleAdd = (): void => {
    setIsAdding(true);
    setFormData({ frequency: "", name: "", tags: "", notes: "" });
  };

  const handleEdit = (bookmark: Bookmark): void => {
    setEditingId(bookmark.id);
    setFormData({
      frequency: (bookmark.frequency / 1e6).toFixed(3), // Show in MHz
      name: bookmark.name,
      tags: bookmark.tags.join(", "),
      notes: bookmark.notes,
    });
  };

  const handleDelete = (id: string): void => {
    // Use accessible, inline confirmation instead of window.confirm
    setPendingDeleteId(id);
  };

  const confirmDelete = (): void => {
    if (!pendingDeleteId) {
      return;
    }
    const bookmark = bookmarks.find((b) => b.id === pendingDeleteId);
    const newBookmarks = bookmarks.filter((b) => b.id !== pendingDeleteId);
    saveBookmarks(newBookmarks);
    if (bookmark) {
      announce(`Deleted bookmark: ${bookmark.name}`);
    }
    setPendingDeleteId(null);
  };

  const cancelDelete = (): void => {
    setPendingDeleteId(null);
  };

  const handleSave = (): void => {
    const freqMHz = parseFloat(formData.frequency);
    const errors: { frequency?: string; name?: string } = {};
    if (isNaN(freqMHz) || freqMHz <= 0) {
      errors.frequency = "Please enter a valid positive frequency in MHz";
    }
    if (!formData.name.trim()) {
      errors.name = "Please enter a bookmark name";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const freqHz = Math.round(freqMHz * 1e6);
    const tags = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (editingId) {
      // Update existing
      const newBookmarks = bookmarks.map((b) =>
        b.id === editingId
          ? {
              ...b,
              frequency: freqHz,
              name: formData.name.trim(),
              tags,
              notes: formData.notes.trim(),
            }
          : b,
      );
      saveBookmarks(newBookmarks);
      announce(`Updated bookmark: ${formData.name}`);
      setEditingId(null);
    } else {
      // Add new
      const newBookmark: Bookmark = {
        id: generateBookmarkId(),
        frequency: freqHz,
        name: formData.name.trim(),
        tags,
        notes: formData.notes.trim(),
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
      saveBookmarks([...bookmarks, newBookmark]);
      announce(`Added bookmark: ${formData.name}`);
      setIsAdding(false);
    }
  };

  const handleCancel = (): void => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleTune = (bookmark: Bookmark): void => {
    // Update last used timestamp
    const newBookmarks = bookmarks.map((b) =>
      b.id === bookmark.id ? { ...b, lastUsed: Date.now() } : b,
    );
    saveBookmarks(newBookmarks);

    // Navigate to Monitor page with frequency parameter
    void navigate(
      `/monitor?frequency=${encodeURIComponent(bookmark.frequency)}`,
    );
    announce(
      `Tuning to ${bookmark.name} at ${formatFrequency(bookmark.frequency)}`,
    );
  };

  const containerClass = isPanel ? "panel-container" : "page-container";
  const showForm = isAdding || editingId !== null;
  const bookmarkToDelete = pendingDeleteId
    ? bookmarks.find((b) => b.id === pendingDeleteId)
    : null;

  return (
    <div
      className={containerClass}
      role={isPanel ? "complementary" : "main"}
      aria-labelledby="bookmarks-heading"
    >
      {pendingDeleteId && bookmarkToDelete && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-desc"
          className="confirm-dialog"
        >
          <h4 id="confirm-delete-title">Delete bookmark?</h4>
          <p id="confirm-delete-desc">
            Are you sure you want to delete “{bookmarkToDelete.name}” at{" "}
            {formatFrequency(bookmarkToDelete.frequency)}?
          </p>
          <div className="confirm-actions">
            <button onClick={confirmDelete}>Delete</button>
            <button onClick={cancelDelete}>Cancel</button>
          </div>
        </div>
      )}
      <h2 id="bookmarks-heading">Bookmarks</h2>

      {!showForm && (
        <>
          <section aria-label="Bookmark Search">
            <input
              type="search"
              placeholder="Search bookmarks..."
              aria-label="Search bookmarks"
              value={searchQuery}
              onChange={(e): void => setSearchQuery(e.target.value)}
            />
          </section>

          <section aria-label="Bookmark List">
            <h3>
              Your Bookmarks{" "}
              {filteredBookmarks.length !== bookmarks.length &&
                `(${filteredBookmarks.length} of ${bookmarks.length})`}
            </h3>

            {filteredBookmarks.length === 0 ? (
              <p>
                {searchQuery
                  ? "No bookmarks match your search."
                  : "No bookmarks yet. Add bookmarks to save frequencies."}
              </p>
            ) : (
              <ul className="bookmark-list" aria-label="Bookmarks">
                {filteredBookmarks.map((bookmark) => (
                  <li key={bookmark.id} className="bookmark-item">
                    <div className="bookmark-info">
                      <strong>{bookmark.name}</strong>
                      <span className="bookmark-frequency">
                        {formatFrequency(bookmark.frequency)}
                      </span>
                      {bookmark.tags.length > 0 && (
                        <span className="bookmark-tags">
                          {bookmark.tags.map((tag) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                      {bookmark.notes && (
                        <span className="bookmark-notes">{bookmark.notes}</span>
                      )}
                      <span className="bookmark-meta">
                        Last used: {formatDate(bookmark.lastUsed)}
                      </span>
                    </div>
                    <div className="bookmark-actions">
                      <button
                        onClick={(): void => handleTune(bookmark)}
                        aria-label={`Tune to ${bookmark.name}`}
                        title="Tune to this frequency"
                      >
                        Tune
                      </button>
                      <button
                        onClick={(): void => handleEdit(bookmark)}
                        aria-label={`Edit ${bookmark.name}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(): void => handleDelete(bookmark.id)}
                        aria-label={`Delete ${bookmark.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Add Bookmark">
            <button onClick={handleAdd}>Add Bookmark</button>
          </section>
        </>
      )}

      {showForm && (
        <section
          aria-label={editingId ? "Edit Bookmark" : "Add Bookmark"}
          className="bookmark-form"
        >
          <h3>{editingId ? "Edit Bookmark" : "Add Bookmark"}</h3>

          <label htmlFor="bookmark-frequency">
            Frequency (MHz):
            <input
              id="bookmark-frequency"
              type="text"
              value={formData.frequency}
              aria-invalid={Boolean(formErrors.frequency)}
              aria-describedby={
                formErrors.frequency ? "bookmark-frequency-error" : undefined
              }
              onChange={(e): void =>
                setFormData({ ...formData, frequency: e.target.value })
              }
              placeholder="100.500"
              aria-required="true"
            />
            {formErrors.frequency && (
              <div id="bookmark-frequency-error" role="alert">
                {formErrors.frequency}
              </div>
            )}
          </label>

          <label htmlFor="bookmark-name">
            Name:
            <input
              id="bookmark-name"
              type="text"
              value={formData.name}
              aria-invalid={Boolean(formErrors.name)}
              aria-describedby={
                formErrors.name ? "bookmark-name-error" : undefined
              }
              onChange={(e): void =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="NOAA Weather Radio"
              aria-required="true"
            />
            {formErrors.name && (
              <div id="bookmark-name-error" role="alert">
                {formErrors.name}
              </div>
            )}
          </label>

          <label htmlFor="bookmark-tags">
            Tags (comma-separated):
            <input
              id="bookmark-tags"
              type="text"
              value={formData.tags}
              onChange={(e): void =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder="weather, FM, emergency"
            />
          </label>

          <label htmlFor="bookmark-notes">
            Notes:
            <textarea
              id="bookmark-notes"
              value={formData.notes}
              onChange={(e): void =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes about this frequency"
              rows={3}
            />
          </label>

          <div className="form-actions">
            <button onClick={handleSave}>{editingId ? "Update" : "Add"}</button>
            <button onClick={handleCancel}>Cancel</button>
          </div>
        </section>
      )}
    </div>
  );
}

export default Bookmarks;
