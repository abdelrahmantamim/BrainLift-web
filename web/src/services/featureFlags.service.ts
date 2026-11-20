interface FeatureFlag {
  id: string
  name: string
  description: string
  enabled: boolean
}

interface FeatureFlagsResponse {
  flags: FeatureFlag[]
}

interface FeatureFlagsCache {
  flags: Record<string, boolean>
  timestamp: number
}

class FeatureFlagsService {
  private cache: FeatureFlagsCache | null = null
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly API_URL = import.meta.env.VITE_API_URL || 'https://api.getbrainlift.app/api'

  private async fetchFlags(): Promise<Record<string, boolean>> {
    try {
      const response = await fetch(`${this.API_URL}/feature-flags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // No auth needed for public feature flags endpoint
      })

      if (!response.ok) {
        console.error(`Failed to fetch feature flags: ${response.statusText}`)
        return this.getDefaultFlags()
      }

      const data: FeatureFlagsResponse = await response.json()
      const flagsMap: Record<string, boolean> = {}
      
      if (data.flags && Array.isArray(data.flags)) {
        data.flags.forEach(flag => {
          flagsMap[flag.id] = flag.enabled
        })
      }

      return flagsMap
    } catch (error) {
      console.error('Error fetching feature flags:', error)
      return this.getDefaultFlags()
    }
  }

  private getDefaultFlags(): Record<string, boolean> {
    // Default to enabled for all flags to maintain functionality if API fails
    return {
      'web-login-enabled': true
    }
  }

  private isCacheValid(): boolean {
    if (!this.cache) return false
    return Date.now() - this.cache.timestamp < this.CACHE_TTL
  }

  private async getFlags(): Promise<Record<string, boolean>> {
    if (this.isCacheValid() && this.cache) {
      return this.cache.flags
    }

    const flags = await this.fetchFlags()
    this.cache = {
      flags,
      timestamp: Date.now()
    }

    return flags
  }

  async isWebLoginEnabled(): Promise<boolean> {
    const flags = await this.getFlags()
    return flags['web-login-enabled'] ?? true // Default to true if not found
  }

  async getFlag(flagId: string): Promise<boolean> {
    const flags = await this.getFlags()
    return flags[flagId] ?? false
  }

  // Method to clear cache and force refresh
  clearCache(): void {
    this.cache = null
  }

  // Method to get all flags
  async getAllFlags(): Promise<Record<string, boolean>> {
    return this.getFlags()
  }
}

export const featureFlagsService = new FeatureFlagsService()