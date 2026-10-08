using IDS.Project.Domain.Common;

namespace IDS.Project.Domain.Entities;

public sealed class WeightMultiplierSetting : BaseEntity
{
    public string Category { get; set; } = string.Empty;

    public string Key { get; set; } = string.Empty;

    public decimal Value { get; set; }
}
