import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GA4_MEASUREMENT_ID,
  trackGA4Event,
  trackGA4PageView,
  setGA4UserId,
  trackGA4SignUp,
  trackGA4Login,
  trackGA4Search,
  trackGA4ViewItem,
  trackGA4AddToWishlist,
  trackGA4GenerateLead,
  trackGA4ScrollDepth,
  trackGA4TimeOnPage,
  trackGA4OutboundClick,
  trackGA4Conversion,
  initGA4,
} from './ga4';

describe('GA4 Integration', () => {
  let gtagMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagMock = vi.fn();
    (window as any).gtag = gtagMock;
    (window as any).dataLayer = [];
  });

  afterEach(() => {
    delete (window as any).gtag;
    delete (window as any).dataLayer;
    vi.restoreAllMocks();
  });

  describe('GA4_MEASUREMENT_ID', () => {
    it('exports the correct measurement ID', () => {
      expect(GA4_MEASUREMENT_ID).toBe('G-N5T31YT52K');
    });
  });

  describe('trackGA4Event', () => {
    it('calls gtag with event name and params', () => {
      trackGA4Event('test_event', { key: 'value' });
      expect(gtagMock).toHaveBeenCalledWith('event', 'test_event', { key: 'value' });
    });

    it('calls gtag with empty params when none provided', () => {
      trackGA4Event('simple_event');
      expect(gtagMock).toHaveBeenCalledWith('event', 'simple_event', {});
    });

    it('does not throw when gtag is not available', () => {
      delete (window as any).gtag;
      expect(() => trackGA4Event('test_event')).not.toThrow();
    });
  });

  describe('trackGA4PageView', () => {
    it('sends page_view event with path and title', () => {
      trackGA4PageView('/dashboard', 'Dashboard');
      expect(gtagMock).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({
        page_path: '/dashboard',
        page_title: 'Dashboard',
      }));
    });

    it('includes page_location from window.location.href', () => {
      trackGA4PageView('/home', 'Home');
      const callArgs = gtagMock.mock.calls[0];
      expect(callArgs[2]).toHaveProperty('page_location');
    });

    it('does not throw when gtag is not available', () => {
      delete (window as any).gtag;
      expect(() => trackGA4PageView('/test', 'Test')).not.toThrow();
    });
  });

  describe('setGA4UserId', () => {
    it('sets user_id via gtag', () => {
      setGA4UserId('user-abc');
      expect(gtagMock).toHaveBeenCalledWith('set', 'user_id', 'user-abc');
    });

    it('sets user_properties via gtag', () => {
      setGA4UserId('user-xyz');
      expect(gtagMock).toHaveBeenCalledWith('set', 'user_properties', { user_id: 'user-xyz' });
    });

    it('does not call gtag when userId is null', () => {
      setGA4UserId(null);
      expect(gtagMock).not.toHaveBeenCalled();
    });

    it('does not throw when gtag is not available', () => {
      delete (window as any).gtag;
      expect(() => setGA4UserId('user-1')).not.toThrow();
    });
  });

  describe('trackGA4SignUp', () => {
    it('tracks sign_up event with default method', () => {
      trackGA4SignUp();
      expect(gtagMock).toHaveBeenCalledWith('event', 'sign_up', { method: 'email' });
    });

    it('tracks sign_up event with custom method', () => {
      trackGA4SignUp('google');
      expect(gtagMock).toHaveBeenCalledWith('event', 'sign_up', { method: 'google' });
    });
  });

  describe('trackGA4Login', () => {
    it('tracks login event with default method', () => {
      trackGA4Login();
      expect(gtagMock).toHaveBeenCalledWith('event', 'login', { method: 'email' });
    });

    it('tracks login event with custom method', () => {
      trackGA4Login('sso');
      expect(gtagMock).toHaveBeenCalledWith('event', 'login', { method: 'sso' });
    });
  });

  describe('trackGA4Search', () => {
    it('tracks search event with term and results count', () => {
      trackGA4Search('widgets', 42);
      expect(gtagMock).toHaveBeenCalledWith('event', 'search', {
        search_term: 'widgets',
        results_count: 42,
      });
    });
  });

  describe('trackGA4ViewItem', () => {
    it('tracks view_item event with item details', () => {
      trackGA4ViewItem('item-1', 'Widget Pro', 'electronics', 99.99);
      expect(gtagMock).toHaveBeenCalledWith('event', 'view_item', {
        items: [{
          item_id: 'item-1',
          item_name: 'Widget Pro',
          item_category: 'electronics',
          price: 99.99,
        }],
      });
    });

    it('handles optional category and value', () => {
      trackGA4ViewItem('item-2', 'Basic Widget');
      const callArgs = gtagMock.mock.calls[0];
      expect(callArgs[2].items[0].item_category).toBeUndefined();
      expect(callArgs[2].items[0].price).toBeUndefined();
    });
  });

  describe('trackGA4AddToWishlist', () => {
    it('tracks add_to_wishlist event', () => {
      trackGA4AddToWishlist('item-3', 'Saved Item', 'services');
      expect(gtagMock).toHaveBeenCalledWith('event', 'add_to_wishlist', {
        items: [{
          item_id: 'item-3',
          item_name: 'Saved Item',
          item_category: 'services',
        }],
      });
    });
  });

  describe('trackGA4GenerateLead', () => {
    it('tracks generate_lead event with listing details', () => {
      trackGA4GenerateLead('lst-1', 'Great Business');
      expect(gtagMock).toHaveBeenCalledWith('event', 'generate_lead', {
        listing_id: 'lst-1',
        listing_name: 'Great Business',
        currency: 'USD',
      });
    });
  });

  describe('trackGA4ScrollDepth', () => {
    it('tracks scroll_25 for 25-49% scroll', () => {
      trackGA4ScrollDepth(30, '/page');
      expect(gtagMock).toHaveBeenCalledWith('event', 'scroll_25', { page_path: '/page' });
    });

    it('tracks scroll_50 for 50-74% scroll', () => {
      trackGA4ScrollDepth(60, '/page');
      expect(gtagMock).toHaveBeenCalledWith('event', 'scroll_50', { page_path: '/page' });
    });

    it('tracks scroll_75 for 75-89% scroll', () => {
      trackGA4ScrollDepth(80, '/page');
      expect(gtagMock).toHaveBeenCalledWith('event', 'scroll_75', { page_path: '/page' });
    });

    it('tracks scroll_90 for 90%+ scroll', () => {
      trackGA4ScrollDepth(95, '/page');
      expect(gtagMock).toHaveBeenCalledWith('event', 'scroll_90', { page_path: '/page' });
    });

    it('does not track scroll below 25%', () => {
      trackGA4ScrollDepth(10, '/page');
      expect(gtagMock).not.toHaveBeenCalled();
    });
  });

  describe('trackGA4TimeOnPage', () => {
    it('tracks time_on_page with milliseconds conversion', () => {
      trackGA4TimeOnPage(120, '/article');
      expect(gtagMock).toHaveBeenCalledWith('event', 'time_on_page', {
        page_path: '/article',
        engagement_time_msec: 120000,
      });
    });
  });

  describe('trackGA4OutboundClick', () => {
    it('tracks outbound click event', () => {
      trackGA4OutboundClick('https://example.com', 'Example');
      expect(gtagMock).toHaveBeenCalledWith('event', 'click', {
        outbound: true,
        link_url: 'https://example.com',
        link_text: 'Example',
      });
    });

    it('handles missing link text', () => {
      trackGA4OutboundClick('https://example.com');
      expect(gtagMock).toHaveBeenCalledWith('event', 'click', {
        outbound: true,
        link_url: 'https://example.com',
        link_text: undefined,
      });
    });
  });

  describe('trackGA4Conversion', () => {
    it('tracks conversion with type and value', () => {
      trackGA4Conversion('signup', 100);
      expect(gtagMock).toHaveBeenCalledWith('event', 'conversion', {
        conversion_type: 'signup',
        value: 100,
        currency: 'USD',
      });
    });

    it('handles conversion without value', () => {
      trackGA4Conversion('nda_signed');
      expect(gtagMock).toHaveBeenCalledWith('event', 'conversion', {
        conversion_type: 'nda_signed',
        value: undefined,
        currency: 'USD',
      });
    });
  });

  describe('initGA4', () => {
    beforeEach(() => {
      // Remove gtag so initGA4 can set it up
      delete (window as any).gtag;
    });

    it('initializes dataLayer and gtag function', () => {
      initGA4('G-TESTID1234');
      expect(window.dataLayer).toBeDefined();
      expect(typeof window.gtag).toBe('function');
    });

    it('does not initialize if measurement ID is placeholder', () => {
      initGA4('G-XXXXXXXXXX');
      expect((window as any).gtag).toBeUndefined();
    });

    it('does not re-initialize if gtag is already present', () => {
      const existingGtag = vi.fn();
      (window as any).gtag = existingGtag;
      initGA4('G-TESTID1234');
      // The function should still be the original mock, not replaced
      expect(window.gtag).toBe(existingGtag);
    });

    it('sets up cross-domain linker configuration', () => {
      initGA4('G-TESTID1234');
      // After init, dataLayer should have the linker set call
      const linkerCall = window.dataLayer.find(
        (entry: unknown) => Array.isArray(entry) && entry[0] === 'set' && entry[1] === 'linker'
      );
      expect(linkerCall).toBeDefined();
    });

    it('configures the measurement ID with send_page_view false', () => {
      initGA4('G-TESTID1234');
      const configCall = window.dataLayer.find(
        (entry: unknown) => Array.isArray(entry) && entry[0] === 'config' && entry[1] === 'G-TESTID1234'
      );
      expect(configCall).toBeDefined();
    });
  });
});
