import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { notify } from "../lib/notifications";
import {
  downloadBookmarksCSV,
  parseBookmarksCSV,
  mergeBookmarks,
  type ImportPreview,
  type DuplicateStrategy,
} from "../utils/bookmark-import-export";
import {
  loadBookmarks,
  saveBookmarks as saveBookmarksToStorage,
} from "../utils/bookmarkStorage";
import { formatFrequency } from "../utils/frequency";
import { generateBookmarkId } from "../utils/id";
import type { Bookmark } from "../types/bookmark";

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

interface BookmarksProps {
  isPanel?: boolean; // True when rendered as a side panel, false for full-page route
}

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
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateStrategy>("skip");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);

  const navigate = useNavigate();
  // Unified notifications

  // Load bookmarks from localStorage
  useEffect(() => {
    setBookmarks(loadBookmarks());
  }, []);

  // Focus management and keyboard handling for import preview dialog
  useEffect((): (() => void) | undefined => {
    if (importPreview && dialogRef.current) {
      const currentImportButton = importButtonRef.current;

      // Focus the dialog
      dialogRef.current.focus();

      // Handle Escape key to close dialog
      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          setImportPreview(null);
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      // Cleanup function to restore focus and remove listener
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        // Restore focus to the import button when dialog closes
        if (currentImportButton) {
          currentImportButton.focus();
        }
      };
    }
    return undefined;
  }, [importPreview]);

  // Save bookmarks to localStorage
  const saveBookmarks = (newBookmarks: Bookmark[]): void => {
    setBookmarks(newBookmarks);
    saveBookmarksToStorage(newBookmarks);
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
      notify({
        message: `Deleted bookmark: ${bookmark.name}`,
        sr: "polite",
        visual: true,
        tone: "info",
      });
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
      notify({
        message: `Updated bookmark: ${formData.name}`,
        sr: "polite",
        visual: true,
        tone: "success",
      });
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
      notify({
        message: `Added bookmark: ${formData.name}`,
        sr: "polite",
        visual: true,
        tone: "success",
      });
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
    notify({
      message: `Tuning to ${bookmark.name} at ${formatFrequency(bookmark.frequency)}`,
      sr: "polite",
      visual: true,
      tone: "info",
    });
  };

  const handleExport = (): void => {
    downloadBookmarksCSV(bookmarks);
    notify({
      message: `Exported ${bookmarks.length} bookmark${bookmarks.length !== 1 ? "s" : ""} to CSV`,
      sr: "polite",
      visual: true,
      tone: "success",
    });
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    // Primarily check file extension; reject obvious non-CSV MIME types (images, videos)
    // Some systems report CSV with various MIME types (application/csv, text/x-csv, etc.)
    if (
      !file.name.toLowerCase().endsWith(".csv") ||
      (file.type &&
        (file.type.startsWith("image/") || file.type.startsWith("video/")))
    ) {
      notify({
        message: "Please select a CSV file",
        sr: "assertive",
        visual: true,
        tone: "error",
      });
      // Reset file input to allow re-selection of the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Read file
    const reader = new FileReader();
    reader.onload = (e): void => {
      const content = e.target?.result as string;
      if (!content) {
        notify({
          message: "Failed to read file",
          sr: "assertive",
          visual: true,
          tone: "error",
        });
        return;
      }

      try {
        const preview = parseBookmarksCSV(content, bookmarks);
        setImportPreview(preview);
        setDuplicateStrategy("skip"); // Reset to default
      } catch (error) {
        notify({
          message: `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
          sr: "assertive",
          visual: true,
          tone: "error",
        });
      }
    };

    reader.onerror = (): void => {
      notify({
        message: "Failed to read file",
        sr: "assertive",
        visual: true,
        tone: "error",
      });
    };

    reader.readAsText(file);

    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportConfirm = (): void => {
    if (!importPreview) {
      return;
    }

    const merged = mergeBookmarks(bookmarks, importPreview, duplicateStrategy);
    saveBookmarks(merged);

    const totalImported =
      importPreview.valid.length +
      (duplicateStrategy === "skip" ? 0 : importPreview.duplicates.length);

    let message = `Imported ${totalImported} bookmark${totalImported !== 1 ? "s" : ""}`;

    if (duplicateStrategy === "skip" && importPreview.duplicates.length > 0) {
      message += `, ${importPreview.duplicates.length} duplicate${importPreview.duplicates.length !== 1 ? "s" : ""} skipped`;
    } else if (
      duplicateStrategy === "overwrite" &&
      importPreview.duplicates.length > 0
    ) {
      message += `, ${importPreview.duplicates.length} duplicate${importPreview.duplicates.length !== 1 ? "s" : ""} overwritten`;
    } else if (
      duplicateStrategy === "import_as_new" &&
      importPreview.duplicates.length > 0
    ) {
      message += `, ${importPreview.duplicates.length} duplicate${importPreview.duplicates.length !== 1 ? "s" : ""} imported as new`;
    }

    if (importPreview.errors.length > 0) {
      message += `, ${importPreview.errors.length} error${importPreview.errors.length !== 1 ? "s" : ""}`;
    }

    notify({
      message,
      sr: "polite",
      visual: true,
      tone: importPreview.errors.length > 0 ? "warning" : "success",
    });

    setImportPreview(null);
  };

  const handleImportCancel = (): void => {
    setImportPreview(null);
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

      {importPreview && (
        <>
          <div
            className="modal-backdrop"
            onClick={handleImportCancel}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="import-preview-title"
            aria-describedby="import-preview-desc"
            className="import-preview-dialog"
            tabIndex={-1}
          >
            <h4 id="import-preview-title">Import Bookmarks Preview</h4>

            <div id="import-preview-desc" className="import-summary">
              <p>
                <strong>Valid bookmarks:</strong> {importPreview.valid.length}
              </p>
              {importPreview.duplicates.length > 0 && (
                <p>
                  <strong>Duplicates detected:</strong>{" "}
                  {importPreview.duplicates.length}
                </p>
              )}
              {importPreview.errors.length > 0 && (
                <p className="error-summary">
                  <strong>Errors:</strong> {importPreview.errors.length}
                </p>
              )}
            </div>

            {importPreview.duplicates.length > 0 && (
              <fieldset className="duplicate-options">
                <legend>How to handle duplicates?</legend>
                <label htmlFor="strategy-skip">
                  <input
                    id="strategy-skip"
                    type="radio"
                    name="duplicateStrategy"
                    value="skip"
                    checked={duplicateStrategy === "skip"}
                    onChange={(): void => setDuplicateStrategy("skip")}
                  />
                  Skip duplicates (keep existing)
                </label>
                <label htmlFor="strategy-overwrite">
                  <input
                    id="strategy-overwrite"
                    type="radio"
                    name="duplicateStrategy"
                    value="overwrite"
                    checked={duplicateStrategy === "overwrite"}
                    onChange={(): void => setDuplicateStrategy("overwrite")}
                  />
                  Overwrite existing with imported
                </label>
                <label htmlFor="strategy-import-as-new">
                  <input
                    id="strategy-import-as-new"
                    type="radio"
                    name="duplicateStrategy"
                    value="import_as_new"
                    checked={duplicateStrategy === "import_as_new"}
                    onChange={(): void => setDuplicateStrategy("import_as_new")}
                  />
                  Import duplicates as new bookmarks
                </label>
              </fieldset>
            )}

            {importPreview.duplicates.length > 0 && (
              <details className="duplicate-list">
                <summary>View duplicate bookmarks</summary>
                <ul>
                  {importPreview.duplicates.map((dup) => (
                    <li key={`${dup.imported.id}-${dup.existing.id}`}>
                      <strong>Imported:</strong> {dup.imported.name} at{" "}
                      {formatFrequency(dup.imported.frequency)}
                      <br />
                      <strong>Existing:</strong> {dup.existing.name} at{" "}
                      {formatFrequency(dup.existing.frequency)}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {importPreview.errors.length > 0 && (
              <details className="error-list">
                <summary>View errors ({importPreview.errors.length})</summary>
                <ul>
                  {importPreview.errors.map((error, idx) => (
                    <li key={`${error.row}-${idx}`} className="error-item">
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {importPreview.valid.length > 0 && (
              <details className="valid-list">
                <summary>
                  View valid bookmarks ({importPreview.valid.length})
                </summary>
                <ul>
                  {importPreview.valid.slice(0, 10).map((bookmark) => (
                    <li key={bookmark.id}>
                      {bookmark.name} - {formatFrequency(bookmark.frequency)}
                      {bookmark.tags.length > 0 && (
                        <span className="preview-tags">
                          {" "}
                          ({bookmark.tags.join(", ")})
                        </span>
                      )}
                    </li>
                  ))}
                  {importPreview.valid.length > 10 && (
                    <li>...and {importPreview.valid.length - 10} more</li>
                  )}
                </ul>
              </details>
            )}

            <div className="import-actions">
              <button
                onClick={handleImportConfirm}
                disabled={
                  importPreview.valid.length === 0 &&
                  importPreview.duplicates.length === 0
                }
              >
                Import
              </button>
              <button onClick={handleImportCancel}>Cancel</button>
            </div>
          </div>
        </>
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

          <section aria-label="Bookmark Actions">
            <button onClick={handleAdd}>Add Bookmark</button>
            {bookmarks.length > 0 && (
              <button
                onClick={handleExport}
                aria-label="Export bookmarks to CSV"
              >
                Export CSV
              </button>
            )}
            <button
              ref={importButtonRef}
              onClick={handleImportClick}
              aria-label="Import bookmarks from CSV"
            >
              Import CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: "none" }}
              aria-hidden="true"
            />
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
