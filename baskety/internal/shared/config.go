package shared

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all application configuration.
type Config struct {
	Server struct {
		Port      int    `mapstructure:"port"`
		PublicURL string `mapstructure:"public_url"`
	} `mapstructure:"server"`
	Database struct {
		URL string `mapstructure:"url"`
	} `mapstructure:"database"`
	Log struct {
		Level  string `mapstructure:"level"`
		Format string `mapstructure:"format"`
	} `mapstructure:"log"`
}

// Load reads config.yaml (if present) and applies environment variable overrides.
// Environment variables are mapped with underscores, e.g. DATABASE_URL → database.url.
func Load() (*Config, error) {
	v := viper.New()

	// Defaults
	v.SetDefault("server.port", 8080)
	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")

	// Config file
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("reading config file: %w", err)
		}
		// config.yaml is optional; env vars or defaults suffice
	}

	// Environment variable overrides: BASKETY_DATABASE_URL → database.url
	v.SetEnvPrefix("BASKETY")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshalling config: %w", err)
	}

	if cfg.Database.URL == "" {
		return nil, fmt.Errorf("required config field database.url is not set (set BASKETY_DATABASE_URL or config.yaml database.url)")
	}

	return &cfg, nil
}
