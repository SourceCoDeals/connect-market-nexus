
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				// SourceCo Brand Colors
				sourceco: {
					DEFAULT: 'hsl(var(--sourceco-primary))',
					foreground: 'hsl(var(--sourceco-primary-foreground))',
					accent: 'hsl(var(--sourceco-accent))',
					'accent-foreground': 'hsl(var(--sourceco-accent-foreground))',
					muted: 'hsl(var(--sourceco-muted))',
					'muted-foreground': 'hsl(var(--sourceco-muted-foreground))',
					background: 'hsl(var(--sourceco-background))',
					form: 'hsl(var(--sourceco-form))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			boxShadow: {
				'xs': 'var(--shadow-xs)',
				'sm': 'var(--shadow-sm)',
				'md': 'var(--shadow-md)',
				'lg': 'var(--shadow-lg)',
				'xl': 'var(--shadow-xl)',
				'2xl': 'var(--shadow-2xl)',
				'glow': 'var(--shadow-glow)',
				'glow-lg': 'var(--shadow-glow-lg)',
			},
			backgroundImage: {
				'gradient-subtle': 'var(--gradient-subtle)',
				'gradient-card': 'var(--gradient-card)',
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-accent': 'var(--gradient-accent)',
				'gradient-shine': 'var(--gradient-shine)',
			},
			fontSize: {
				'hero-sm': ['var(--font-size-hero-sm)', { lineHeight: 'var(--line-height-hero)', letterSpacing: 'var(--letter-spacing-hero)' }],
				'hero-md': ['var(--font-size-hero-md)', { lineHeight: 'var(--line-height-hero)', letterSpacing: 'var(--letter-spacing-hero)' }],
				'hero-lg': ['var(--font-size-hero-lg)', { lineHeight: 'var(--line-height-hero)', letterSpacing: 'var(--letter-spacing-hero)' }],
				'hero-xl': ['var(--font-size-hero-xl)', { lineHeight: 'var(--line-height-hero)', letterSpacing: 'var(--letter-spacing-hero)' }],
				'hero-2xl': ['var(--font-size-hero-2xl)', { lineHeight: 'var(--line-height-hero)', letterSpacing: 'var(--letter-spacing-hero)' }],
			},
			spacing: {
				'section': 'var(--spacing-section)',
				'card': 'var(--spacing-card)',
				'element': 'var(--spacing-element)',
				'compact': 'var(--spacing-compact)',
				'tight': 'var(--spacing-tight)',
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['Monaco', 'Consolas', 'monospace'],
			},
			fontFeatureSettings: {
				'tabular': '"tnum"',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				shimmer: {
					from: {
						backgroundPosition: '200% 0'
					},
					to: {
						backgroundPosition: '-200% 0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				shimmer: 'shimmer 2s linear infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
