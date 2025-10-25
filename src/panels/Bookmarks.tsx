import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveRegion } from "../hooks/useLiveRegion";
import { formatFrequency, generateBookmarkId } from "../utils/frequency";

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

  // Filter and search bookmarks
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery) {
      return bookmarks;
    }

    const query = searchQuery.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.tags.some((t) => t.toLowerCase().includes(query)) ||
        b.notes.toLowerCase().includes(query) ||
        formatFrequency(b.frequency).toLowerCase().includes(query),
    );
  }, [bookmarks, searchQuery]);

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
    const bookmark = bookmarks.find((b) => b.id === id);
    if (!bookmark) {
      return;
    }

    if (
      !window.confirm(
        `Delete bookmark "${bookmark.name}" at ${formatFrequency(bookmark.frequency)}?`,
      )
    ) {
      return;
    }

    const newBookmarks = bookmarks.filter((b) => b.id !== id);
    saveBookmarks(newBookmarks);
    announce(`Deleted bookmark: ${bookmark.name}`);
  };

  const handleSave = (): void => {
    const freqMHz = parseFloat(formData.frequency);
    if (isNaN(freqMHz) || freqMHz <= 0) {
      alert("Please enter a valid frequency in MHz");
      return;
    }

    if (!formData.name.trim()) {
      alert("Please enter a bookmark name");
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
    void navigate(`/monitor?frequency=${bookmark.frequency}`);
    announce(
      `Tuning to ${bookmark.name} at ${formatFrequency(bookmark.frequency)}`,
    );
  };

  const containerClass = isPanel ? "panel-container" : "page-container";
  const showForm = isAdding || editingId !== null;

  return (
    <div
      className={containerClass}
      role={isPanel ? "complementary" : "main"}
      aria-labelledby="bookmarks-heading"
    >
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
              onChange={(e): void =>
                setFormData({ ...formData, frequency: e.target.value })
              }
              placeholder="100.500"
              aria-required="true"
            />
          </label>

          <label htmlFor="bookmark-name">
            Name:
            <input
              id="bookmark-name"
              type="text"
              value={formData.name}
              onChange={(e): void =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="NOAA Weather Radio"
              aria-required="true"
            />
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
