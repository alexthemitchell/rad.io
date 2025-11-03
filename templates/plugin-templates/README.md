# Plugin Templates

This directory contains starter templates for creating rad.io plugins.

## Available Templates

- **[demodulator-plugin-template.ts](./demodulator-plugin-template.ts)** - Template for demodulator plugins
- **[visualization-plugin-template.ts](./visualization-plugin-template.ts)** - Template for visualization plugins
- **[device-driver-plugin-template.ts](./device-driver-plugin-template.ts)** - Template for device driver plugins

## Using a Template

1. **Copy the template** to your plugin directory:

   ```bash
   cp templates/plugin-templates/demodulator-plugin-template.ts \
      src/plugins/demodulators/MyDemodulatorPlugin.ts
   ```

2. **Search and replace** the placeholder names:
   - `TemplateDemodulator` → `MyDemodulator`
   - `template-demodulator` → `my-demodulator`
   - `Template Demodulator` → `My Demodulator`

3. **Implement the TODOs** marked in the template

4. **Add tests** in `__tests__/MyDemodulatorPlugin.test.ts`

5. **Export your plugin** in `src/plugins/index.ts`:

   ```typescript
   export { MyDemodulatorPlugin } from "./demodulators/MyDemodulatorPlugin";
   ```

## Quick Start Example

```bash
# Copy template
cp templates/plugin-templates/demodulator-plugin-template.ts \
   src/plugins/demodulators/AMDemodulatorPlugin.ts

# Replace placeholders (Linux)
sed -i 's/TemplateDemodulator/AMDemodulator/g' \
   src/plugins/demodulators/AMDemodulatorPlugin.ts
sed -i 's/template-demodulator/am-demodulator/g' \
   src/plugins/demodulators/AMDemodulatorPlugin.ts

# Or on macOS (BSD sed requires empty string after -i)
sed -i '' 's/TemplateDemodulator/AMDemodulator/g' \
   src/plugins/demodulators/AMDemodulatorPlugin.ts
sed -i '' 's/template-demodulator/am-demodulator/g' \
   src/plugins/demodulators/AMDemodulatorPlugin.ts

# Edit the file and implement your logic
code src/plugins/demodulators/AMDemodulatorPlugin.ts

# Add tests
code src/plugins/demodulators/__tests__/AMDemodulatorPlugin.test.ts

# Export
echo "export { AMDemodulatorPlugin } from \"./demodulators/AMDemodulatorPlugin\";" >> \
   src/plugins/index.ts
```

## Documentation

- [Tutorial: Creating Your First Plugin](../../docs/tutorials/03-creating-plugins.md)
- [How-To: Create a Demodulator Plugin](../../docs/how-to/create-demodulator-plugin.md)
- [How-To: Create a Visualization Plugin](../../docs/how-to/create-visualization-plugin.md)
- [How-To: Create a Device Driver Plugin](../../docs/how-to/create-device-driver-plugin.md)

## Tips

- **Start simple**: Begin with minimal functionality and add features incrementally
- **Test early**: Write tests as you develop, not after
- **Follow conventions**: Use the same patterns as existing plugins
- **Document thoroughly**: Add JSDoc comments for all public methods
- **Check types**: Run `npm run type-check` frequently

## Need Help?

- See the [example plugins](../../src/plugins/) for reference implementations
- Check [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions) for community support
- Read the [Plugin API Reference](../../docs/reference/plugin-api.md) (coming soon)
