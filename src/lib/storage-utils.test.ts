import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available when vi.mock factory runs (hoisted above imports)
const { mockListBuckets, mockCreateBucket, mockGetPublicUrl, mockUpload, mockList, mockRemove } =
  vi.hoisted(() => {
    return {
      mockListBuckets: vi.fn(),
      mockCreateBucket: vi.fn(),
      mockGetPublicUrl: vi.fn(),
      mockUpload: vi.fn(),
      mockList: vi.fn(),
      mockRemove: vi.fn(),
    };
  });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      listBuckets: mockListBuckets,
      createBucket: mockCreateBucket,
      from: vi.fn(() => ({
        getPublicUrl: mockGetPublicUrl,
        upload: mockUpload,
        list: mockList,
        remove: mockRemove,
      })),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

import {
  LISTINGS_BUCKET,
  DEFAULT_IMAGE,
  ensureListingsBucketExists,
  uploadListingImage,
  deleteListingImages,
} from './storage-utils';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('constants', () => {
  it('exports correct bucket name', () => {
    expect(LISTINGS_BUCKET).toBe('listings');
  });

  it('exports a default image URL', () => {
    expect(DEFAULT_IMAGE).toContain('unsplash.com');
  });
});

describe('ensureListingsBucketExists', () => {
  it('returns true when bucket already exists and public URL works', async () => {
    mockListBuckets.mockResolvedValue({
      data: [{ name: 'listings' }, { name: 'avatars' }],
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.com/test' },
    });

    const result = await ensureListingsBucketExists();
    expect(result).toBe(true);
    expect(mockCreateBucket).not.toHaveBeenCalled();
  });

  it('returns false when listBuckets has an error', async () => {
    mockListBuckets.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' },
    });

    const result = await ensureListingsBucketExists();
    expect(result).toBe(false);
  });

  it('attempts to create bucket when it does not exist', async () => {
    mockListBuckets.mockResolvedValue({
      data: [{ name: 'avatars' }],
      error: null,
    });
    mockCreateBucket.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.com/test' },
    });

    const result = await ensureListingsBucketExists();
    expect(result).toBe(true);
  });

  it('returns false when createBucket fails', async () => {
    mockListBuckets.mockResolvedValue({
      data: [],
      error: null,
    });
    mockCreateBucket.mockResolvedValue({
      error: { message: 'RLS violation' },
    });
    mockGetPublicUrl.mockReturnValue({ data: null });

    const result = await ensureListingsBucketExists();
    expect(result).toBe(false);
  });

  it('returns false when getPublicUrl returns no data', async () => {
    mockListBuckets.mockResolvedValue({
      data: [{ name: 'listings' }],
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({ data: null });

    const result = await ensureListingsBucketExists();
    expect(result).toBe(false);
  });
});

describe('uploadListingImage', () => {
  it('uploads file and returns public URL on success', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.example.com/listings/123/file.jpg' },
    });

    const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const url = await uploadListingImage(mockFile, 'listing-123');

    expect(url).toBe('https://storage.example.com/listings/123/file.jpg');
    expect(mockUpload).toHaveBeenCalled();
  });

  it('throws when upload fails', async () => {
    mockUpload.mockResolvedValue({ error: new Error('Upload failed') });

    const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    await expect(uploadListingImage(mockFile, 'listing-123')).rejects.toThrow('Upload failed');
  });

  it('throws when getPublicUrl returns empty publicUrl', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: '' },
    });

    const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    await expect(uploadListingImage(mockFile, 'listing-123')).rejects.toThrow(
      'Failed to get public URL',
    );
  });
});

describe('deleteListingImages', () => {
  it('returns true when files are listed and deleted successfully', async () => {
    mockList.mockResolvedValue({
      data: [{ name: 'img1.jpg' }, { name: 'img2.png' }],
      error: null,
    });
    mockRemove.mockResolvedValue({ error: null });

    const result = await deleteListingImages('listing-456');
    expect(result).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith(['listing-456/img1.jpg', 'listing-456/img2.png']);
  });

  it('returns true when no files exist for the listing', async () => {
    mockList.mockResolvedValue({ data: [], error: null });

    const result = await deleteListingImages('listing-empty');
    expect(result).toBe(true);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('returns false when listing files fails', async () => {
    mockList.mockResolvedValue({
      data: null,
      error: { message: 'Access denied' },
    });

    const result = await deleteListingImages('listing-err');
    expect(result).toBe(false);
  });

  it('returns false when remove fails', async () => {
    mockList.mockResolvedValue({
      data: [{ name: 'file.jpg' }],
      error: null,
    });
    mockRemove.mockResolvedValue({ error: { message: 'Delete failed' } });

    const result = await deleteListingImages('listing-delfail');
    expect(result).toBe(false);
  });
});
